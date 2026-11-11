export type ExternalCashflow = {
  date: string
  amountCzk: number
}

export type PortfolioValuation = {
  date: string
  valueCzk: number
}

export type ReturnMetric = {
  available: boolean
  value: number | null
  startDate: string | null
  endDate: string | null
  reason: string | null
}

export type PerformanceReturns = {
  firstExternalCashflowDate: string | null
  xirr: ReturnMetric
  twr: ReturnMetric
}

const DAYS_PER_YEAR = 365.2425
const EPSILON = 1e-10

function toUtcDay(date: string) {
  const parts = date.split('-').map(Number)
  return Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86_400_000
}

function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(toUtcDay(date))
}

function normalizeCashflows(cashflows: ExternalCashflow[]) {
  return cashflows
    .filter((item) => isValidDate(item.date) && Number.isFinite(item.amountCzk) && item.amountCzk !== 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function normalizeValuations(valuations: PortfolioValuation[]) {
  const byDate = new Map<string, number>()

  for (const valuation of valuations) {
    if (!isValidDate(valuation.date) || !Number.isFinite(valuation.valueCzk) || valuation.valueCzk < 0) continue
    byDate.set(valuation.date, valuation.valueCzk)
  }

  return Array.from(byDate, ([date, valueCzk]) => ({ date, valueCzk }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function unavailable(reason: string): ReturnMetric {
  return {
    available: false,
    value: null,
    startDate: null,
    endDate: null,
    reason,
  }
}

function xnpv(rate: number, flows: ExternalCashflow[]) {
  const startDay = toUtcDay(flows[0].date)

  return flows.reduce((total, flow) => {
    const years = (toUtcDay(flow.date) - startDay) / DAYS_PER_YEAR
    return total + flow.amountCzk / Math.pow(1 + rate, years)
  }, 0)
}

export function calculateXirr(
  externalCashflows: ExternalCashflow[],
  currentValueCzk: number,
  valuationDate: string,
): ReturnMetric {
  const cashflows = normalizeCashflows(externalCashflows)

  if (cashflows.length === 0) {
    return unavailable('XIRR vyžaduje alespoň jeden evidovaný externí vklad nebo výběr.')
  }

  if (!isValidDate(valuationDate) || !Number.isFinite(currentValueCzk) || currentValueCzk < 0) {
    return unavailable('Chybí platná koncová hodnota portfolia.')
  }

  const firstDate = cashflows[0].date
  if (valuationDate <= firstDate) {
    return unavailable('Koncové ocenění musí být pozdější než první externí cashflow.')
  }

  // Z pohledu investora je vklad záporný a výběr kladný.
  const flows: ExternalCashflow[] = cashflows.map((flow) => ({
    date: flow.date,
    amountCzk: -flow.amountCzk,
  }))

  flows.push({ date: valuationDate, amountCzk: currentValueCzk })

  const hasNegative = flows.some((flow) => flow.amountCzk < 0)
  const hasPositive = flows.some((flow) => flow.amountCzk > 0)
  if (!hasNegative || !hasPositive) {
    return unavailable('XIRR vyžaduje alespoň jeden záporný a jeden kladný peněžní tok.')
  }

  let low = -0.999999
  let high = 1
  let lowValue = xnpv(low, flows)
  let highValue = xnpv(high, flows)

  while (lowValue * highValue > 0 && high < 1_000_000) {
    high *= 2
    highValue = xnpv(high, flows)
  }

  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || lowValue * highValue > 0) {
    return unavailable('Pro zadané peněžní toky nebylo možné najít jednoznačné XIRR.')
  }

  let rate = 0
  for (let iteration = 0; iteration < 200; iteration += 1) {
    rate = (low + high) / 2
    const value = xnpv(rate, flows)

    if (Math.abs(value) < EPSILON) break

    if (lowValue * value <= 0) {
      high = rate
      highValue = value
    } else {
      low = rate
      lowValue = value
    }
  }

  return {
    available: true,
    value: rate,
    startDate: firstDate,
    endDate: valuationDate,
    reason: null,
  }
}

function cashflowByDate(cashflows: ExternalCashflow[]) {
  const result = new Map<string, number>()
  for (const flow of cashflows) {
    result.set(flow.date, (result.get(flow.date) ?? 0) + flow.amountCzk)
  }
  return result
}

export function calculateTwr(
  externalCashflows: ExternalCashflow[],
  valuations: PortfolioValuation[],
): ReturnMetric {
  const cashflows = normalizeCashflows(externalCashflows)
  const snapshots = normalizeValuations(valuations)

  if (cashflows.length === 0) {
    return unavailable('TWR vyžaduje alespoň jeden evidovaný externí vklad nebo výběr.')
  }

  const firstDate = cashflows[0].date
  const relevant = snapshots.filter((snapshot) => snapshot.date >= firstDate)

  if (relevant.length < 2) {
    return unavailable('TWR vyžaduje alespoň dvě ocenění portfolia od prvního externího cashflow.')
  }

  const flows = cashflowByDate(cashflows)
  let cumulative = 1
  let linkedPeriods = 0

  for (let index = 1; index < relevant.length; index += 1) {
    const previous = relevant[index - 1]
    const current = relevant[index]
    const externalFlow = flows.get(current.date) ?? 0

    if (previous.valueCzk <= 0) continue

    // Modified Dietz pro jednodenní / mezisnapshotové období s tokem na konci období.
    const periodReturn = (current.valueCzk - externalFlow - previous.valueCzk) / previous.valueCzk
    if (!Number.isFinite(periodReturn) || periodReturn <= -1) continue

    cumulative *= 1 + periodReturn
    linkedPeriods += 1
  }

  if (linkedPeriods === 0) {
    return unavailable('Mezi snapshoty není dostatek platných období pro výpočet TWR.')
  }

  return {
    available: true,
    value: cumulative - 1,
    startDate: relevant[0].date,
    endDate: relevant[relevant.length - 1].date,
    reason: null,
  }
}

export function calculatePerformanceReturns(
  externalCashflows: ExternalCashflow[],
  valuations: PortfolioValuation[],
): PerformanceReturns {
  const cashflows = normalizeCashflows(externalCashflows)
  const snapshots = normalizeValuations(valuations)
  const lastSnapshot = snapshots.at(-1)

  return {
    firstExternalCashflowDate: cashflows[0]?.date ?? null,
    xirr: lastSnapshot
      ? calculateXirr(cashflows, lastSnapshot.valueCzk, lastSnapshot.date)
      : unavailable('Chybí koncové ocenění portfolia.'),
    twr: calculateTwr(cashflows, snapshots),
  }
}
