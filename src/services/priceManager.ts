import { supabase } from '../lib/supabase'

export async function getPriceInstruments() {
  const { data, error } = await supabase
    .from('instruments')
    .select('id,name,ticker')
    .not('ticker', 'is', null)
    .order('ticker')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function savePrice(
  instrumentId: string,
  price: number
) {
  const today = new Date()
    .toISOString()
    .substring(0, 10)

  const { error } = await supabase
    .from('price_history')
    .upsert(
      {
        instrument_id: instrumentId,
        price_date: today,
        close_price: price,
        source: 'MANUAL',
      },
      {
        onConflict:
          'instrument_id,price_date',
      }
    )

  if (error) {
    throw error
  }
}