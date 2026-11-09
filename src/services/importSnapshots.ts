import { supabase } from '../lib/supabase'
import fireData from '../data/fireData.json'

const PORTFOLIO_ID =
  '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export async function importSnapshots() {
  const snapshots =
    fireData.history.map((item) => ({
      portfolio_id: PORTFOLIO_ID,
      snapshot_date: item.date,
      net_worth: item.amount,
      invested_amount: null,
    }))

  const { error } = await supabase
    .from('portfolio_snapshots')
    .upsert(
      snapshots,
      {
        onConflict:
          'portfolio_id,snapshot_date',
      }
    )

  if (error) {
    throw error
  }

  return snapshots.length
}