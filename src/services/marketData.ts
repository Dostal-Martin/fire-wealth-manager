import { supabase } from '../lib/supabase'

export async function getMarketInstruments() {
  const { data, error } = await supabase
    .from('instruments')
    .select(`
      id,
      name,
      ticker,
      asset_type
    `)
    .not('ticker', 'is', null)
    .order('ticker')

  if (error) {
    throw error
  }

  return data ?? []
}