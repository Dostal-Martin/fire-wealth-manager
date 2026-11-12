export type PerformancePeriod = '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y' | 'MAX'

export type PricePoint = { date: string; value: number }
export type PerformanceQuality = 'FULL' | 'PARTIAL' | 'UNAVAILABLE'

export type PeriodBoundary = {
  period: PerformancePeriod
  requestedStartDate: string | null
  effectiveStartDate: string | null
  endDate: string
  startValue: number | null
  endValue: number | null
  priceReturnPercent: number | null
  quality: PerformanceQuality
  reason: string | null
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function subtractMonths(date: Date, months: number) {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() - months)
  return result
}

function subtractYears(date: Date, years: number) {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() - years)
  return result
}

export function requestedStartDate(period: PerformancePeriod, endDate: string) {
  const end = parseDate(endDate)
  if (period === 'MAX') return null
  if (period === 'YTD') return `${end.getUTCFullYear()}-01-01`
  if (period === '1M') return formatDate(subtractMonths(end, 1))
  if (period === '3M') return formatDate(subtractMonths(end, 3))
  if (period === '6M') return formatDate(subtractMonths(end, 6))
  if (period === '1Y') return formatDate(subtractYears(end, 1))
  if (period === '3Y') return formatDate(subtractYears(end, 3))
  return formatDate(subtractYears(end, 5))
}

export function calculatePricePeriod(
  period: PerformancePeriod,
  points: PricePoint[],
): PeriodBoundary {
  const valid = points
    .filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.value) && point.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  const end = valid.at(-1)
  if (!end) {
    return { period, requestedStartDate: null, effectiveStartDate: null, endDate: '', startValue: null, endValue: null, priceReturnPercent: null, quality: 'UNAVAILABLE', reason: 'Chybí cenová historie.' }
  }

  const requested = requestedStartDate(period, end.date)
  const start = period === 'MAX'
    ? valid[0]
    : valid.find((point) => point.date >= (requested ?? ''))

  if (!start || start.date === end.date) {
    return { period, requestedStartDate: requested, effectiveStartDate: start?.date ?? null, endDate: end.date, startValue: start?.value ?? null, endValue: end.value, priceReturnPercent: null, quality: 'UNAVAILABLE', reason: 'Chybí ocenění na začátku období.' }
  }

  const partial = requested !== null && start.date > requested
  return {
    period,
    requestedStartDate: requested,
    effectiveStartDate: start.date,
    endDate: end.date,
    startValue: start.value,
    endValue: end.value,
    priceReturnPercent: ((end.value / start.value) - 1) * 100,
    quality: partial ? 'PARTIAL' : 'FULL',
    reason: partial ? `Historie začíná až ${start.date}.` : null,
  }
}
