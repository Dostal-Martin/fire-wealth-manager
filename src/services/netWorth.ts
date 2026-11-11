import {
  supabase,
} from '../lib/supabase'

import {
  calculateNetWorth,
} from '../domain/netWorthCalculations'

const PORTFOLIO_ID =
  '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type CurrentNetWorth = {
  assets: number
  liabilities: number
  netWorth: number
  positionCount: number
}

export type LatestSnapshot = {
  id: string
  date: string
  value: number
}

export function getLocalDateString(
  date = new Date()
) {
  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0')

  const day =
    String(
      date.getDate()
    ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export async function getCurrentNetWorth():
  Promise<CurrentNetWorth> {
  const {
    data,
    error,
  } =
    await supabase
      .from('positions')
      .select(`
        id,
        current_value
      `)
      .eq(
        'portfolio_id',
        PORTFOLIO_ID
      )

  if (error) {
    throw error
  }

  const calculation =
    calculateNetWorth(
      (
        data ?? []
      ).map(
        (position) => ({
          current_value:
            position.current_value,
        })
      )
    )

  return {
    assets:
      calculation.assets,

    liabilities:
      calculation.liabilities,

    netWorth:
      calculation.netWorth,

    positionCount:
      calculation.positionCount,
  }
}

export async function getLatestSnapshot():
  Promise<LatestSnapshot | null> {
  const {
    data,
    error,
  } =
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
    getLocalDateString()

  if (
    !Number.isFinite(
      current.netWorth
    )
  ) {
    throw new Error(
      'Aktuální čisté jmění není platné číslo.'
    )
  }

  const {
    error,
  } =
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
    getLocalDateString()

  const {
    data,
    error,
  } =
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