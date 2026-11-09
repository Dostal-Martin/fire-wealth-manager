import { supabase } from '../lib/supabase'

export async function getInstruments() {
  const { data, error } = await supabase
    .from('instruments')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function createInstrument(
  name: string,
  ticker: string,
  assetType: string,
  currency: string
) {
  const { error } = await supabase
    .from('instruments')
    .insert({
      name,
      ticker:
        ticker.trim() === ''
          ? null
          : ticker.trim(),
      asset_type: assetType,
      currency,
      pricing_source:
        ticker.trim() === ''
          ? 'manual'
          : 'yahoo',
    })

  if (error) {
    throw error
  }
}

export async function updateInstrument(
  id: string,
  name: string,
  ticker: string,
  assetType: string,
  currency: string
) {
  const { error } = await supabase
    .from('instruments')
    .update({
      name,
      ticker:
        ticker.trim() === ''
          ? null
          : ticker.trim(),
      asset_type: assetType,
      currency,
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function deleteInstrument(
  id: string
) {
  const { error } = await supabase
    .from('instruments')
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}