import { supabase } from '../lib/supabase'

export async function getAllocation() {
  const { data, error } = await supabase
    .from('positions')
    .select(`
      current_value,
      instruments (
        asset_type
      )
    `)

  if (error) {
    throw error
  }

  const allocationMap: Record<
    string,
    number
  > = {}

  data?.forEach((position: any) => {
    const type =
      position.instruments?.asset_type ??
      'Ostatní'

    allocationMap[type] =
      (allocationMap[type] ?? 0) +
      Number(position.current_value)
  })

  return Object.entries(
    allocationMap
  ).map(([name, value]) => ({
    name,
    value,
  }))
}
