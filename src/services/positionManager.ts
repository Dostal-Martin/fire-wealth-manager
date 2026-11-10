import { supabase } from '../lib/supabase'

const PORTFOLIO_ID =
  '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export async function getInstrumentsForPosition() {
  const { data, error } = await supabase
    .from('instruments')
    .select('id,name')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getPositions() {
  const { data, error } = await supabase
    .from('positions')
    .select(`
      *,
      instruments (
        name
      )
    `)
    .order('created_at')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function createPosition(
  instrumentId: string,
  quantity: number,
  totalCost: number,
  currentValue: number
) {
  const { error } = await supabase
    .from('positions')
    .insert({
      portfolio_id: PORTFOLIO_ID,
      instrument_id: instrumentId,
      quantity,
      total_cost: totalCost,
      current_value: currentValue,
    })

  if (error) {
    throw error
  }
}

export async function updatePosition(
  id: string,
  instrumentId: string,
  quantity: number,
  totalCost: number,
  currentValue: number
) {
  const { error } = await supabase
    .from('positions')
    .update({
      instrument_id: instrumentId,
      quantity,
      total_cost: totalCost,
      current_value: currentValue,
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function deletePosition(
  id: string
) {
  const { error } = await supabase
    .from('positions')
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}