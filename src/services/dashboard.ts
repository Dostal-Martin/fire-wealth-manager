import { supabase } from '../lib/supabase'

export async function getInstrumentCount() {
  const { count, error } = await supabase
    .from('instruments')
    .select('*', {
      count: 'exact',
      head: true,
    })

  if (error) {
    throw error
  }

  return count ?? 0
}