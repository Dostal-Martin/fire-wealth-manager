import { supabase } from '../lib/supabase'

export async function getMarketInstruments() {
  const { data, error } = await supabase
    .from('instruments')
    .select(`
      id,
      name,
      ticker,
      currency,
      asset_type,
      pricing_source
    `)
    .not('ticker', 'is', null)
    .order('ticker')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getLatestPrices() {
  const { data, error } = await supabase
    .from('price_history')
    .select(`
      instrument_id,
      price_date,
      close_price,
      source
    `)
    .order('price_date', {
      ascending: false,
    })

  if (error) {
    throw error
  }

  const latest = new Map()

  for (const row of data ?? []) {
    if (!latest.has(row.instrument_id)) {
      latest.set(
        row.instrument_id,
        row
      )
    }
  }

  return latest
}

export async function getLatestFxRates() {
  const { data, error } = await supabase
    .from('fx_history')
    .select(`
      currency_pair,
      fx_date,
      fx_rate
    `)
    .order('fx_date', {
      ascending: false,
    })

  if (error) {
    throw error
  }

  const rates: Record<string, any> = {}

  for (const row of data ?? []) {
    if (!rates[row.currency_pair]) {
      rates[row.currency_pair] = row
    }
  }

  return rates
}

export async function updateMarketPrices() {
  const { data, error } =
    await supabase.functions.invoke(
      'update-prices',
      {
        body: {},
      }
    )

  if (error) {
    throw error
  }

  return data
}