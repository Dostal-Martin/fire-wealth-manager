import { supabase } from '../lib/supabase'

export type PriceInstrument = {
  id: string
  name: string
  ticker: string
  currency: string | null
}

export type PriceHistoryRow = {
  id: number
  instrument_id: string
  price_date: string
  close_price: number
  source: string | null
}

export async function getPriceInstruments() {
  const { data, error } = await supabase
    .from('instruments')
    .select(`
      id,
      name,
      ticker,
      currency
    `)
    .eq('pricing_source', 'yahoo')
    .not('ticker', 'is', null)
    .order('ticker')

  if (error) {
    throw error
  }

  return (data ?? []).map(
    (instrument) => ({
      id: instrument.id,
      name: instrument.name,
      ticker: instrument.ticker ?? '',
      currency: instrument.currency,
    })
  ) as PriceInstrument[]
}

export async function getInstrumentPriceHistory(
  instrumentId: string
) {
  const pageSize = 1000

  let from = 0
  let allRows: PriceHistoryRow[] = []

  while (true) {
    const { data, error } = await supabase
      .from('price_history')
      .select(`
        id,
        instrument_id,
        price_date,
        close_price,
        source
      `)
      .eq('instrument_id', instrumentId)
      .order('price_date', {
        ascending: true,
      })
      .range(
        from,
        from + pageSize - 1
      )

    if (error) {
      throw error
    }

    const page = (data ?? []).map(
      (row) => ({
        id: Number(row.id),
        instrument_id:
          row.instrument_id,
        price_date:
          row.price_date,
        close_price:
          Number(row.close_price),
        source:
          row.source,
      })
    ) as PriceHistoryRow[]

    allRows = [
      ...allRows,
      ...page,
    ]

    if (page.length < pageSize) {
      break
    }

    from += pageSize
  }

  return allRows
}