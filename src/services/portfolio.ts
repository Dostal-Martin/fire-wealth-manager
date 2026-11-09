import { supabase } from '../lib/supabase'

export async function getPortfolioPositions() {
  const { data, error } = await supabase
    .from('positions')
    .select(`
      id,
      quantity,
      total_cost,
      current_value,
      instruments (
        name,
        asset_type
      )
    `)

  if (error) {
    throw error
  }

  const sorted = (data ?? []).sort(
    (a, b) =>
      Number(b.current_value) -
      Number(a.current_value)
  )

  return sorted
}