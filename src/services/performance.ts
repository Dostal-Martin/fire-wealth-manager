import {
  supabase,
} from '../lib/supabase'

import {
  calculateCagr,
  calculateModifiedDietzTwr,
  type PerformanceExternalCashflow,
  type PerformanceSnapshot,
} from '../domain/performanceCalculations'

import {
  getXirr,
} from './xirr'

type PerformanceResult = {
  xirr: number | null

  startValue: number
  currentValue: number
  totalGrowth: number
  totalGrowthPercent: number
  netWorthCagr: number | null

  ath: number
  athDate: string
  drawdown: number

  twr: number | null
  twrStartDate: string | null
  twrEndDate: string | null
  twrMessage: string
}

export async function getPerformanceStats():
  Promise<PerformanceResult> {
  const [
    snapshotsResult,
    cashflowsResult,
    xirrValue,
  ] =
    await Promise.all([
      supabase
        .from(
          'portfolio_snapshots'
        )
        .select(
          'snapshot_date,net_worth'
        )
        .order(
          'snapshot_date',
          {
            ascending: true,
          }
        ),

      supabase
        .from('cashflows')
        .select(
          'transaction_date,amount_czk'
        )
        .eq(
          'is_external',
          true
        )
        .order(
          'transaction_date',
          {
            ascending: true,
          }
        ),

      getXirr(),
    ])

  if (
    snapshotsResult.error
  ) {
    throw snapshotsResult.error
  }

  if (
    cashflowsResult.error
  ) {
    throw cashflowsResult.error
  }

  const snapshots =
    (
      snapshotsResult.data ??
      []
    ) as PerformanceSnapshot[]

  const externalCashflows =
    (
      cashflowsResult.data ??
      []
    ) as PerformanceExternalCashflow[]

  if (
    snapshots.length === 0
  ) {
    throw new Error(
      'V portfolio_snapshots nejsou žádná data.'
    )
  }

  const firstSnapshot =
    snapshots[0]

  const latestSnapshot =
    snapshots[
      snapshots.length - 1
    ]

  const startValue =
    Number(
      firstSnapshot.net_worth
    )

  const currentValue =
    Number(
      latestSnapshot.net_worth
    )

  if (
    !Number.isFinite(
      startValue
    ) ||
    !Number.isFinite(
      currentValue
    )
  ) {
    throw new Error(
      'Historie majetku obsahuje neplatnou hodnotu čistého jmění.'
    )
  }

  const totalGrowth =
    currentValue -
    startValue

  const totalGrowthPercent =
    startValue > 0
      ? (
          currentValue /
            startValue -
          1
        ) * 100
      : 0

  const netWorthCagr =
    calculateCagr(
      startValue,
      currentValue,
      firstSnapshot
        .snapshot_date,
      latestSnapshot
        .snapshot_date
    )

  let athSnapshot =
    firstSnapshot

  for (
    const snapshot of
    snapshots
  ) {
    const snapshotValue =
      Number(
        snapshot.net_worth
      )

    const currentAthValue =
      Number(
        athSnapshot.net_worth
      )

    if (
      Number.isFinite(
        snapshotValue
      ) &&
      snapshotValue >
        currentAthValue
    ) {
      athSnapshot =
        snapshot
    }
  }

  const ath =
    Number(
      athSnapshot.net_worth
    )

  const drawdown =
    ath > 0
      ? (
          currentValue /
            ath -
          1
        ) * 100
      : 0

  const twrResult =
    calculateModifiedDietzTwr(
      snapshots,
      externalCashflows
    )

  const normalizedXirr =
    xirrValue !== null &&
    Number.isFinite(
      xirrValue
    )
      ? xirrValue
      : null

  return {
    xirr:
      normalizedXirr,

    startValue,

    currentValue,

    totalGrowth,

    totalGrowthPercent,

    netWorthCagr,

    ath,

    athDate:
      athSnapshot
        .snapshot_date,

    drawdown,

    twr:
      twrResult.twr,

    twrStartDate:
      twrResult.startDate,

    twrEndDate:
      twrResult.endDate,

    twrMessage:
      twrResult.message,
  }
}