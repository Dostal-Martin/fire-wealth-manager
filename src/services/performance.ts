import { supabase } from '../lib/supabase'
import { getXirr } from './xirr'

type Snapshot = {
  snapshot_date: string
  net_worth: number | string
}

type ExternalCashflow = {
  transaction_date: string
  amount_czk: number | string
}

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

const millisecondsPerDay =
  24 * 60 * 60 * 1000

function parseDate(date: string) {
  return new Date(
    `${date}T12:00:00Z`
  )
}

function daysBetween(
  startDate: string,
  endDate: string
) {
  return (
    parseDate(endDate).getTime() -
    parseDate(startDate).getTime()
  ) / millisecondsPerDay
}

function calculateCagr(
  startValue: number,
  endValue: number,
  startDate: string,
  endDate: string
) {
  if (
    startValue <= 0 ||
    endValue <= 0
  ) {
    return null
  }

  const years =
    daysBetween(
      startDate,
      endDate
    ) / 365.25

  if (years <= 0) {
    return null
  }

  return (
    (
      Math.pow(
        endValue / startValue,
        1 / years
      ) - 1
    ) * 100
  )
}

function calculateModifiedDietzTwr(
  snapshots: Snapshot[],
  externalCashflows:
    ExternalCashflow[]
) {
  if (
    externalCashflows.length === 0
  ) {
    return {
      twr: null,
      startDate: null,
      endDate: null,
      message:
        'TWR zatím nelze spočítat. Nejsou evidované žádné externí vklady nebo výběry.',
    }
  }

  const firstExternalDate =
    externalCashflows[0]
      .transaction_date

  let openingSnapshotIndex = -1

  for (
    let index = 0;
    index < snapshots.length;
    index++
  ) {
    if (
      snapshots[index]
        .snapshot_date <=
      firstExternalDate
    ) {
      openingSnapshotIndex =
        index
    }
  }

  if (openingSnapshotIndex < 0) {
    return {
      twr: null,
      startDate: null,
      endDate: null,
      message:
        'TWR zatím nelze spočítat. Před prvním externím cashflow chybí snapshot hodnoty portfolia.',
    }
  }

  const relevantSnapshots =
    snapshots.slice(
      openingSnapshotIndex
    )

  if (
    relevantSnapshots.length < 2
  ) {
    return {
      twr: null,
      startDate:
        relevantSnapshots[0]
          ?.snapshot_date ??
        null,
      endDate: null,
      message:
        'TWR začne být dostupný po uložení dalšího snapshotu majetku po prvním externím vkladu nebo výběru.',
    }
  }

  let linkedReturn = 1
  let validPeriods = 0

  for (
    let index = 1;
    index <
    relevantSnapshots.length;
    index++
  ) {
    const startSnapshot =
      relevantSnapshots[
        index - 1
      ]

    const endSnapshot =
      relevantSnapshots[index]

    const startValue =
      Number(
        startSnapshot.net_worth
      )

    const endValue =
      Number(
        endSnapshot.net_worth
      )

    const periodDays =
      Math.max(
        daysBetween(
          startSnapshot
            .snapshot_date,
          endSnapshot
            .snapshot_date
        ),
        1
      )

    const periodFlows =
      externalCashflows.filter(
        (flow) =>
          flow.transaction_date >
            startSnapshot
              .snapshot_date &&
          flow.transaction_date <=
            endSnapshot
              .snapshot_date
      )

    const netFlow =
      periodFlows.reduce(
        (sum, flow) =>
          sum +
          Number(
            flow.amount_czk
          ),
        0
      )

    const weightedFlows =
      periodFlows.reduce(
        (sum, flow) => {
          const remainingDays =
            Math.max(
              daysBetween(
                flow.transaction_date,
                endSnapshot
                  .snapshot_date
              ),
              0
            )

          const weight =
            remainingDays /
            periodDays

          return (
            sum +
            Number(
              flow.amount_czk
            ) *
              weight
          )
        },
        0
      )

    const denominator =
      startValue +
      weightedFlows

    if (
      !Number.isFinite(
        denominator
      ) ||
      denominator <= 0
    ) {
      continue
    }

    const periodReturn =
      (
        endValue -
        startValue -
        netFlow
      ) /
      denominator

    if (
      !Number.isFinite(
        periodReturn
      ) ||
      periodReturn <= -1
    ) {
      continue
    }

    linkedReturn *=
      1 + periodReturn

    validPeriods++
  }

  if (validPeriods === 0) {
    return {
      twr: null,
      startDate:
        relevantSnapshots[0]
          .snapshot_date,
      endDate:
        relevantSnapshots[
          relevantSnapshots.length -
            1
        ].snapshot_date,
      message:
        'TWR zatím nemá dostatek platných období pro výpočet.',
    }
  }

  return {
    twr:
      (linkedReturn - 1) *
      100,

    startDate:
      relevantSnapshots[0]
        .snapshot_date,

    endDate:
      relevantSnapshots[
        relevantSnapshots.length -
          1
      ].snapshot_date,

    message:
      'TWR je počítán řetězenou metodou Modified Dietz od prvního spolehlivě evidovaného externího cashflow.',
  }
}

export async function getPerformanceStats():
  Promise<PerformanceResult> {
  const [
    snapshotsResult,
    cashflowsResult,
    xirrValue,
  ] = await Promise.all([
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

  if (snapshotsResult.error) {
    throw snapshotsResult.error
  }

  if (cashflowsResult.error) {
    throw cashflowsResult.error
  }

  const snapshots =
    (
      snapshotsResult.data ??
      []
    ) as Snapshot[]

  const externalCashflows =
    (
      cashflowsResult.data ??
      []
    ) as ExternalCashflow[]

  if (snapshots.length === 0) {
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
    if (
      Number(
        snapshot.net_worth
      ) >
      Number(
        athSnapshot.net_worth
      )
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

  return {
    xirr:
      Number.isFinite(
        Number(xirrValue)
      )
        ? Number(xirrValue)
        : null,

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