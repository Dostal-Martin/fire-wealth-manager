import { supabase } from '../lib/supabase'

export async function getPriceHistory() {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .order('price_date', {
      ascending: false,
    })

  if (error) {
    throw error
  }

  return data ?? []
}