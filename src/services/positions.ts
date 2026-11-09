import { supabase } from '../lib/supabase'

export async function getPortfolioStats() {
  const { data, error } = await supabase
    .from('positions')
    .select('*')

  if (error) {
    throw error
  }

  const portfolioValue = (data ?? []).reduce(
    (sum, item) => sum + Number(item.current_value),
    0
  )

  const investedValue = (data ?? []).reduce(
    (sum, item) => sum + Number(item.total_cost),
    0
  )

  const profit = portfolioValue - investedValue

  return {
    portfolioValue,
    investedValue,
    profit,
    positionCount: data?.length ?? 0,
  }
}