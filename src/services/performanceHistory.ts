import { supabase } from '../lib/supabase'
import {
  calculatePricePeriod,
  type PerformancePeriod,
  type PricePoint,
} from '../domain/performanceHistory'

type PriceRow = { price_date: string; close_price: number | string }
type FxRow = { fx_date: string; fx_rate: number | string }

function latestFxAtOrBefore(rows: FxRow[], date: string) {
  let value = 1
  for (const row of rows) {
    if (row.fx_date > date) break
    const number = Number(row.fx_rate)
    if (Number.isFinite(number) && number > 0) value = number
  }
  return value
}

export async function getInstrumentPricePerformance(
  instrumentId: string,
  currency: string,
  periods: PerformancePeriod[] = ['YTD', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'MAX'],
) {
  const priceResult = await supabase
    .from('price_history')
    .select('price_date,close_price')
    .eq('instrument_id', instrumentId)
    .order('price_date', { ascending: true })

  if (priceResult.error) throw priceResult.error
  const prices = (priceResult.data ?? []) as PriceRow[]

  let fxRows: FxRow[] = []
  const normalizedCurrency = currency.toUpperCase()
  if (normalizedCurrency !== 'CZK') {
    const fxResult = await supabase
      .from('fx_history')
      .select('fx_date,fx_rate')
      .eq('currency_pair', `${normalizedCurrency}CZK`)
      .order('fx_date', { ascending: true })

    if (fxResult.error) throw fxResult.error
    fxRows = (fxResult.data ?? []) as FxRow[]
  }

  const points: PricePoint[] = prices
    .map((row) => {
      const price = Number(row.close_price)
      const fx = normalizedCurrency === 'CZK' ? 1 : latestFxAtOrBefore(fxRows, row.price_date)
      return { date: row.price_date, value: price * fx }
    })
    .filter((point) => Number.isFinite(point.value) && point.value > 0)

  return periods.map((period) => calculatePricePeriod(period, points))
}
