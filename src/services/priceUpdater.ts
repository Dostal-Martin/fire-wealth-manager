import { supabase } from '../lib/supabase'

export type UpdatedPrice = {
  name: string
  ticker: string
  price: number
  currency: string
  fxRate: number
  priceDate: string
}

export type PriceUpdateResult = {
  ok: boolean

  fx?: {
    date: string
    USDCZK: number
    EURCZK: number
  }

  processed: number
  updatedCount: number
  errorCount: number

  updated: UpdatedPrice[]

  errors: Array<{
    name: string
    ticker: string
    error: string
  }>
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

  return data as PriceUpdateResult
}

export function pricesUpdatedToday() {
  const lastUpdate =
    localStorage.getItem(
      'firewm-last-price-update'
    )

  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  return lastUpdate === today
}

export function markPricesUpdatedToday() {
  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  localStorage.setItem(
    'firewm-last-price-update',
    today
  )
}