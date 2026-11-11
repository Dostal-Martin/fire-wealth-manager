export type XirrCashflow = {
  date: string
  amount: number
}

const DAY_MS =
  24 * 60 * 60 * 1000

const MAX_ITERATIONS =
  100

const TOLERANCE =
  0.000001

const DERIVATIVE_STEP =
  0.0001

function parseDate(
  value: string
) {
  return new Date(
    `${value}T12:00:00Z`
  )
}

function normalizeCashflows(
  cashflows: XirrCashflow[]
) {
  return cashflows
    .filter(
      (cashflow) =>
        Boolean(
          cashflow.date
        ) &&
        Number.isFinite(
          cashflow.amount
        )
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(
          b.date
        )
    )
}

export function isValidXirrInput(
  cashflows: XirrCashflow[]
) {
  const normalized =
    normalizeCashflows(
      cashflows
    )

  if (
    normalized.length < 2
  ) {
    return false
  }

  const hasNegative =
    normalized.some(
      (cashflow) =>
        cashflow.amount < 0
    )

  const hasPositive =
    normalized.some(
      (cashflow) =>
        cashflow.amount > 0
    )

  return (
    hasNegative &&
    hasPositive
  )
}

export function xnpv(
  rate: number,
  cashflows: XirrCashflow[]
) {
  const normalized =
    normalizeCashflows(
      cashflows
    )

  if (
    normalized.length === 0 ||
    rate <= -1
  ) {
    return Number.NaN
  }

  const firstDate =
    parseDate(
      normalized[0].date
    )

  if (
    Number.isNaN(
      firstDate.getTime()
    )
  ) {
    return Number.NaN
  }

  return normalized.reduce(
    (
      total,
      cashflow
    ) => {
      const currentDate =
        parseDate(
          cashflow.date
        )

      if (
        Number.isNaN(
          currentDate.getTime()
        )
      ) {
        return total
      }

      const days =
        (
          currentDate.getTime() -
          firstDate.getTime()
        ) /
        DAY_MS

      return (
        total +
        cashflow.amount /
          Math.pow(
            1 + rate,
            days / 365
          )
      )
    },
    0
  )
}

export function calculateXirr(
  cashflows: XirrCashflow[]
):
  number | null {
  const normalized =
    normalizeCashflows(
      cashflows
    )

  if (
    !isValidXirrInput(
      normalized
    )
  ) {
    return null
  }

  let rate = 0.1

  for (
    let iteration = 0;
    iteration <
    MAX_ITERATIONS;
    iteration += 1
  ) {
    if (
      !Number.isFinite(
        rate
      ) ||
      rate <= -0.999999
    ) {
      return null
    }

    const npv =
      xnpv(
        rate,
        normalized
      )

    const nextNpv =
      xnpv(
        rate +
          DERIVATIVE_STEP,
        normalized
      )

    if (
      !Number.isFinite(
        npv
      ) ||
      !Number.isFinite(
        nextNpv
      )
    ) {
      return null
    }

    const derivative =
      (
        nextNpv -
        npv
      ) /
      DERIVATIVE_STEP

    if (
      !Number.isFinite(
        derivative
      ) ||
      Math.abs(
        derivative
      ) <
        Number.EPSILON
    ) {
      return null
    }

    const newRate =
      rate -
      npv /
        derivative

    if (
      !Number.isFinite(
        newRate
      ) ||
      newRate <=
        -0.999999
    ) {
      return null
    }

    if (
      Math.abs(
        newRate -
        rate
      ) <
      TOLERANCE
    ) {
      return newRate
    }

    rate =
      newRate
  }

  return Number.isFinite(
    rate
  )
    ? rate
    : null
}