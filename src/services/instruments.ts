import { supabase } from '../lib/supabase'

export async function getInstruments() {
  const { data, error } = await supabase
    .from('instruments')
    .select('*')

  console.log('DATA:', data)
  console.log('ERROR:', error)

  if (error) {
    throw error
  }

  return data ?? []
}