export type PerformanceSnapshot = {
  snapshot_date: string
  net_worth:
    | number
    | string
}

export type PerformanceExternalCashflow = {
  transaction_date: string
  amount_czk:
    | number
    | string
}

export type TwrResult = {
  twr: number | null
  startDate: string | null
  endDate: string | null
  message: string
}

const MILLISECONDS_PER_DAY =
  24 * 60 * 60 * 1000

function parseDate(
  date: string
) {
  return new Date(
    `${date}T12:00:00Z`
  )
}

export function daysBetween(
  startDate: string,
  endDate: string
) {
  const start =
    parseDate(
      startDate
    )

  const end =
    parseDate(
      endDate
    )

  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return Number.NaN
  }

  return (
    end.getTime() -
    start.getTime()
  ) /
    MILLISECONDS_PER_DAY
}

export function calculateCagr(
  startValue: number,
  endValue: number,
  startDate: string,
  endDate: string
):
  number | null {
  if (
    !Number.isFinite(
      startValue
    ) ||
    !Number.isFinite(
      endValue
    ) ||
    startValue <= 0 ||
    endValue <= 0
  ) {
    return null
  }

  const days =
    daysBetween(
      startDate,
      endDate
    )

  if (
    !Number.isFinite(days) ||
    days <= 0
  ) {
    return null
  }

  const years =
    days / 365.25

  return (
    (
      Math.pow(
        endValue /
          startValue,
        1 / years
      ) -
      1
    ) *
    100
  )
}

export function calculateModifiedDietzTwr(
  snapshots:
    PerformanceSnapshot[],
  externalCashflows:
    PerformanceExternalCashflow[]
):
  TwrResult {
  const sortedSnapshots =
    [...snapshots]
      .filter(
        (snapshot) =>
          Boolean(
            snapshot.snapshot_date
          ) &&
          Number.isFinite(
            Number(
              snapshot.net_worth
            )
          )
      )
      .sort(
        (a, b) =>
          a.snapshot_date.localeCompare(
            b.snapshot_date
          )
      )

  const sortedCashflows =
    [...externalCashflows]
      .filter(
        (cashflow) =>
          Boolean(
            cashflow.transaction_date
          ) &&
          Number.isFinite(
            Number(
              cashflow.amount_czk
            )
          )
      )
      .sort(
        (a, b) =>
          a.transaction_date.localeCompare(
            b.transaction_date
          )
      )

  if (
    sortedCashflows.length ===
    0
  ) {
    return {
      twr: null,

      startDate: null,

      endDate: null,

      message:
        'TWR zatím nelze spočítat. Nejsou evidované žádné externí vklady nebo výběry.',
    }
  }

  if (
    sortedSnapshots.length ===
    0
  ) {
    return {
      twr: null,

      startDate: null,

      endDate: null,

      message:
        'TWR zatím nelze spočítat. Nejsou dostupné snapshoty hodnoty portfolia.',
    }
  }

  const firstExternalDate =
    sortedCashflows[0]
      .transaction_date

  /*
   * Pro počáteční hodnotu potřebujeme
   * poslední snapshot PŘED prvním
   * externím cashflow.
   *
   * Je to důležité zejména tehdy,
   * když externí cashflow proběhne
   * přesně v den snapshotu.
   *
   * Takový tok patří do období:
   *
   * startSnapshot < flow <= endSnapshot
   */
  let openingSnapshotIndex =
    -1

  for (
    let index = 0;
    index <
    sortedSnapshots.length;
    index += 1
  ) {
    if (
      sortedSnapshots[index]
        .snapshot_date <
      firstExternalDate
    ) {
      openingSnapshotIndex =
        index
    }
  }

  if (
    openingSnapshotIndex <
    0
  ) {
    return {
      twr: null,

      startDate: null,

      endDate: null,

      message:
        'TWR zatím nelze spočítat. Před prvním externím cashflow chybí snapshot hodnoty portfolia.',
    }
  }

  const relevantSnapshots =
    sortedSnapshots.slice(
      openingSnapshotIndex
    )

  if (
    relevantSnapshots.length <
    2
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
    index += 1
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

    if (
      !Number.isFinite(
        startValue
      ) ||
      !Number.isFinite(
        endValue
      )
    ) {
      continue
    }

    const periodDays =
      daysBetween(
        startSnapshot
          .snapshot_date,
        endSnapshot
          .snapshot_date
      )

    if (
      !Number.isFinite(
        periodDays
      ) ||
      periodDays <= 0
    ) {
      continue
    }

    /*
     * Tok přesně v počáteční den
     * není součástí období.
     *
     * Tok přesně v koncový den
     * součástí období je.
     */
    const periodFlows =
      sortedCashflows.filter(
        (flow) =>
          flow.transaction_date >
            startSnapshot
              .snapshot_date &&
          flow.transaction_date <=
            endSnapshot
              .snapshot_date
      )

    const normalizedFlows =
      periodFlows.map(
        (flow) => ({
          amount:
            Number(
              flow.amount_czk
            ),

          transactionDate:
            flow.transaction_date,
        })
      )

    const netFlow =
      normalizedFlows.reduce(
        (sum, flow) =>
          sum +
          flow.amount,
        0
      )

    const weightedFlows =
      normalizedFlows.reduce(
        (
          sum,
          flow
        ) => {
          const remainingDays =
            Math.max(
              daysBetween(
                flow.transactionDate,
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
            flow.amount *
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

    validPeriods += 1
  }

  if (
    validPeriods === 0
  ) {
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
      (
        linkedReturn -
        1
      ) *
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