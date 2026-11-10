import { supabase } from '../lib/supabase'

export async function getNetWorthHistory() {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .order('snapshot_date')

  if (error) {
    throw error
  }

  return (
    data?.map((item) => ({
      date: item.snapshot_date,
      amount: Number(item.net_worth),
    })) ?? []
  )
}