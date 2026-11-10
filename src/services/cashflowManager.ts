import { supabase } from '../lib/supabase'

export async function getCashflows() {
  const { data, error } = await supabase
    .from('cashflows')
    .select(`
      *,
      instruments (
        name
      )
    `)
    .order('transaction_date', {
      ascending: false,
    })

  if (error) {
    throw error
  }

  return data ?? []
}