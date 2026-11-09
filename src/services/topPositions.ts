import { supabase } from '../lib/supabase'

export async function getTopPositions() {
  const { data, error } = await supabase
    .from('positions')
    .select(`
      current_value,
      instruments (
        name
      )
    `)

  if (error) {
    throw error
  }

  return (data ?? [])
    .sort(
      (a, b) =>
        Number(b.current_value) -
        Number(a.current_value)
    )
    .slice(0, 5)
}