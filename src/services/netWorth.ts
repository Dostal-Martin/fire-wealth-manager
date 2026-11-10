import { supabase } from '../lib/supabase'

const PORTFOLIO_ID =
  '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type CurrentNetWorth = {
  assets: number
  liabilities: number
  netWorth: number
  positionCount: number
}

export async function getCurrentNetWorth():
  Promise<CurrentNetWorth> {
  const { data, error } =
    await supabase
      .from('positions')
      .select(`
        id,
        current_value
      `)

  if (error) {
    throw error
  }

  let assets = 0
  let liabilities = 0

  for (
    const position of
    data ?? []
  ) {
    const value =
      Number(
        position.current_value
      )

    if (
      !Number.isFinite(value)
    ) {
      continue
    }

    if (value >= 0) {
      assets =
        assets + value
    } else {
      liabilities =
        liabilities + value
    }
  }

  return {
    assets,

    liabilities,

    netWorth:
      assets +
      liabilities,

    positionCount:
      data?.length ?? 0,
  }
}

export async function getLatestSnapshot() {
  const { data, error } =
    await supabase
      .from(
        'portfolio_snapshots'
      )
      .select(`
        id,
        snapshot_date,
        net_worth
      `)
      .eq(
        'portfolio_id',
        PORTFOLIO_ID
      )
      .order(
        'snapshot_date',
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    id:
      data.id,

    date:
      data.snapshot_date,

    value:
      Number(
        data.net_worth
      ),
  }
}

export async function saveTodaySnapshot() {
  const current =
    await getCurrentNetWorth()

  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  if (
    !Number.isFinite(
      current.netWorth
    )
  ) {
    throw new Error(
      'Aktuální čisté jmění není platné číslo.'
    )
  }

  const { error } =
    await supabase
      .from(
        'portfolio_snapshots'
      )
      .upsert(
        {
          portfolio_id:
            PORTFOLIO_ID,

          snapshot_date:
            today,

          net_worth:
            current.netWorth,
        },
        {
          onConflict:
            'portfolio_id,snapshot_date',
        }
      )

  if (error) {
    throw error
  }

  return {
    date:
      today,

    netWorth:
      current.netWorth,

    assets:
      current.assets,

    liabilities:
      current.liabilities,
  }
}

export async function snapshotExistsToday() {
  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  const { data, error } =
    await supabase
      .from(
        'portfolio_snapshots'
      )
      .select('id')
      .eq(
        'portfolio_id',
        PORTFOLIO_ID
      )
      .eq(
        'snapshot_date',
        today
      )
      .limit(1)

  if (error) {
    throw error
  }

  return (
    data !== null &&
    data.length > 0
  )
}