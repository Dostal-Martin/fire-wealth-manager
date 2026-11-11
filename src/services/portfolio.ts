import { supabase } from '../lib/supabase'

export type PortfolioInstrument = {
  id: string
  name: string
  ticker: string | null
  asset_type: string | null
  currency: string | null
}

export type PortfolioPosition = {
  id: string
  instrument_id: string
  quantity: number
  total_cost: number
  current_value: number
  is_cash: boolean
  instruments: PortfolioInstrument | null
}

type RawInstrument = PortfolioInstrument
type RawPosition = {
  id: string
  instrument_id: string
  quantity: number | string | null
  total_cost: number | string | null
  current_value: number | string | null
  instruments: RawInstrument | RawInstrument[] | null
}

function normalizeInstrument(value: RawInstrument | RawInstrument[] | null) {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function getPortfolioPositions(): Promise<PortfolioPosition[]> {
  const { data, error } = await supabase
    .from('positions')
    .select(`
      id,
      instrument_id,
      quantity,
      total_cost,
      current_value,
      instruments (id,name,ticker,asset_type,currency)
    `)

  if (error) throw error

  return ((data ?? []) as unknown as RawPosition[])
    .map((row) => {
      const instrument = normalizeInstrument(row.instruments)
      return {
        id: row.id,
        instrument_id: row.instrument_id,
        quantity: Number(row.quantity ?? 0),
        total_cost: Number(row.total_cost ?? 0),
        current_value: Number(row.current_value ?? 0),
        is_cash: instrument?.ticker === 'CASH.CZK',
        instruments: instrument,
      }
    })
    .sort((a, b) => b.current_value - a.current_value)
}
