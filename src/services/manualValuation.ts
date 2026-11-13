import { supabase } from '../lib/supabase'

export type ValuationMode = 'unit_price' | 'total_value'
export type ValuationFreshness = 'fresh' | 'warning' | 'stale' | 'missing'

export type ManualInstrument = {
  id: string
  name: string
  ticker: string | null
  currency: string | null
  asset_type: string | null
  valuation_mode: ValuationMode
}

export type ImportedPrice = { price_date: string; close_price: number }

export type ManualValuationOverview = {
  id: string
  name: string
  ticker: string | null
  currency: string | null
  assetType: string | null
  valuationMode: ValuationMode
  quantity: number
  currentValue: number
  latestPrice: number | null
  latestDate: string | null
  priceSource: string | null
  valuationAgeDays: number | null
  valuationFreshness: ValuationFreshness
  valuationFreshnessLabel: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function getLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function parseDateAtUtcNoon(value: string) { return new Date(`${value}T12:00:00Z`) }
export function getValuationAgeDays(valuationDate: string | null, today = getLocalDateString()): number | null {
  if (!valuationDate) return null
  const valuation = parseDateAtUtcNoon(valuationDate)
  const current = parseDateAtUtcNoon(today)
  if (Number.isNaN(valuation.getTime()) || Number.isNaN(current.getTime())) return null
  return Math.max(0, Math.floor((current.getTime() - valuation.getTime()) / DAY_MS))
}
export function getValuationFreshness(valuationDate: string | null, today?: string) {
  const ageDays = getValuationAgeDays(valuationDate, today)
  if (valuationDate === null || ageDays === null) return { ageDays: null, freshness: 'missing' as const, label: 'Chybí datum ocenění' }
  if (ageDays <= 35) return { ageDays, freshness: 'fresh' as const, label: null }
  if (ageDays <= 60) return { ageDays, freshness: 'warning' as const, label: 'Starší ocenění' }
  return { ageDays, freshness: 'stale' as const, label: 'Neaktuální ocenění' }
}

export async function getManualInstruments() {
  const { data, error } = await supabase.from('instruments')
    .select('id,name,ticker,currency,asset_type,valuation_mode')
    .eq('pricing_source', 'manual').order('name')
  if (error) throw error
  return (data ?? []).map((instrument) => ({
    id: instrument.id, name: instrument.name, ticker: instrument.ticker, currency: instrument.currency,
    asset_type: instrument.asset_type ?? null,
    valuation_mode: instrument.valuation_mode === 'total_value' ? 'total_value' : 'unit_price',
  })) as ManualInstrument[]
}

export async function getManualValuationOverview() {
  const { data: instruments, error } = await supabase.from('instruments').select(`
    id,name,ticker,currency,asset_type,valuation_mode,
    positions(quantity,current_value,valuation_date)
  `).eq('pricing_source', 'manual').order('name')
  if (error) throw error

  const result: ManualValuationOverview[] = []
  for (const instrument of instruments ?? []) {
    const { data: prices, error: priceError } = await supabase.from('price_history')
      .select('price_date,close_price,source').eq('instrument_id', instrument.id)
      .order('price_date', { ascending: false }).limit(1)
    if (priceError) throw priceError
    const latestPrice = prices?.[0] ?? null
    const positions = instrument.positions ?? []
    const valuationMode: ValuationMode = instrument.valuation_mode === 'total_value' ? 'total_value' : 'unit_price'
    const quantity = positions.reduce((sum, position) => sum + Number(position.quantity ?? 0), 0)
    const currentValue = positions.reduce((sum, position) => sum + Number(position.current_value ?? 0), 0)
    const positionDates = positions.map((position) => position.valuation_date).filter((date): date is string => Boolean(date)).sort()
    const positionValuationDate = positionDates.length > 0 ? positionDates[0] : null
    const latestDate = valuationMode === 'unit_price' ? latestPrice?.price_date ?? positionValuationDate : positionValuationDate
    const freshness = getValuationFreshness(latestDate)
    result.push({
      id: instrument.id, name: instrument.name, ticker: instrument.ticker, currency: instrument.currency,
      assetType: instrument.asset_type ?? null, valuationMode, quantity, currentValue,
      latestPrice: latestPrice ? Number(latestPrice.close_price) : null,
      latestDate, priceSource: latestPrice?.source ?? null,
      valuationAgeDays: freshness.ageDays, valuationFreshness: freshness.freshness,
      valuationFreshnessLabel: freshness.label,
    })
  }
  return result
}

export async function saveManualUnitPrice(instrumentId: string, date: string, price: number) {
  if (!date) throw new Error('Datum ocenění je povinné.')
  if (!Number.isFinite(price) || price <= 0) throw new Error('Cena musí být větší než nula.')
  const { error: priceError } = await supabase.from('price_history').upsert({
    instrument_id: instrumentId, price_date: date, close_price: price, source: 'MANUAL',
  }, { onConflict: 'instrument_id,price_date' })
  if (priceError) throw priceError
  const { data: positions, error: positionsError } = await supabase.from('positions').select('id,quantity').eq('instrument_id', instrumentId)
  if (positionsError) throw positionsError
  for (const position of positions ?? []) {
    const quantity = Number(position.quantity)
    if (!Number.isFinite(quantity)) continue
    const { error: updateError } = await supabase.from('positions').update({ current_value: quantity * price, valuation_date: date }).eq('id', position.id)
    if (updateError) throw updateError
  }
}

export async function saveManualTotalValue(instrumentId: string, totalValue: number, valuationDate = getLocalDateString()) {
  if (!Number.isFinite(totalValue)) throw new Error('Hodnota musí být platné číslo.')
  if (!valuationDate) throw new Error('Datum ocenění je povinné.')
  const { data: instrument, error: instrumentError } = await supabase.from('instruments').select('asset_type').eq('id', instrumentId).single()
  if (instrumentError) throw instrumentError
  const isLiability = (instrument?.asset_type ?? '').toLocaleLowerCase('cs') === 'pasivum'
  const storedValue = isLiability ? -Math.abs(totalValue) : Math.abs(totalValue)

  const { data: positions, error } = await supabase.from('positions').select('id').eq('instrument_id', instrumentId)
  if (error) throw error
  if (!positions || positions.length === 0) throw new Error('Instrument nemá žádnou pozici.')
  if (positions.length > 1) throw new Error('Instrument má více pozic. Celkovou hodnotu nelze jednoznačně přiřadit.')
  const { error: updateError } = await supabase.from('positions').update({ current_value: storedValue, valuation_date: valuationDate }).eq('id', positions[0].id)
  if (updateError) throw updateError
  return { storedValue, isLiability }
}

export async function importManualPrices(instrumentId: string, rows: ImportedPrice[]) {
  if (rows.length === 0) throw new Error('CSV neobsahuje žádné platné ceny.')
  const databaseRows = rows.map((row) => ({ instrument_id: instrumentId, price_date: row.price_date, close_price: row.close_price, source: 'MANUAL_IMPORT' }))
  for (let start = 0; start < databaseRows.length; start += 500) {
    const { error } = await supabase.from('price_history').upsert(databaseRows.slice(start, start + 500), { onConflict: 'instrument_id,price_date' })
    if (error) throw error
  }
  const latest = [...rows].sort((a, b) => b.price_date.localeCompare(a.price_date))[0]
  await saveManualUnitPrice(instrumentId, latest.price_date, latest.close_price)
  return { importedCount: rows.length, latestDate: latest.price_date, latestPrice: latest.close_price }
}
