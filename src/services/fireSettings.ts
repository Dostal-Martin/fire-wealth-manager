import { supabase } from '../lib/supabase'

export async function getFireSettings() {
  const { data, error } = await supabase
    .from('fire_settings')
    .select('*')
    .limit(1)
    .single()

  if (error) {
    throw error
  }

  return data
}