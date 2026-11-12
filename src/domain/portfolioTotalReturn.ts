import type { PerformancePeriod, PerformanceQuality } from './performanceHistory'

export type PeriodLedgerTransaction = {
  transactionDate: string
  transactionType: 'BUY' | 'SELL'
  quantity: number
  amountCzk: number
}

export type PeriodInvestmentIncome = {
  transactionDate: string
  incomeType: 'DIVIDEND' | 'COUPON' | 'INTEREST'
  amountCzk: number
}

export type InstrumentPeriodInput = {
  instrumentId: string
  instrumentName: string
  period: PerformancePeriod
  requestedStartDate: string | null
  effectiveStartDate: string | null
  endDate: string
  startMarketValueCzk: number | null
  endMarketValueCzk: number | null
  transactions: PeriodLedgerTransaction[]
  incomes: PeriodInvestmentIncome[]
  quality: PerformanceQuality
  qualityReason: string | null
}

export type InstrumentPeriodReturn = {
  instrumentId: string
  instrumentName: string
  period: PerformancePeriod
  startDate: string | null
  endDate: string
  startMarketValueCzk: number | null
  endMarketValueCzk: number | null
  buyCashCzk: number
  sellCashCzk: number
  dividendIncomeCzk: number
  couponIncomeCzk: number
  interestIncomeCzk: number
  investmentIncomeCzk: number
  profitCzk: number | null
  returnPercent: number | null
  quality: PerformanceQuality
  reason: string | null
}

function inPeriod(date: string, startDate: string | null, endDate: string) {
  if (!startDate) return date <= endDate
  return date >= startDate && date <= endDate
}

export function calculateInstrumentPeriodReturn(
  input: InstrumentPeriodInput,
): InstrumentPeriodReturn {
  const startDate = input.effectiveStartDate
  const transactions = input.transactions.filter((item) => inPeriod(item.transactionDate, startDate, input.endDate))
  const incomes = input.incomes.filter((item) => inPeriod(item.transactionDate, startDate, input.endDate))

  const buyCashCzk = transactions
    .filter((item) => item.transactionType === 'BUY')
    .reduce((sum, item) => sum + item.amountCzk, 0)

  const sellCashCzk = transactions
    .filter((item) => item.transactionType === 'SELL')
    .reduce((sum, item) => sum + item.amountCzk, 0)

  const dividendIncomeCzk = incomes
    .filter((item) => item.incomeType === 'DIVIDEND')
    .reduce((sum, item) => sum + item.amountCzk, 0)

  const couponIncomeCzk = incomes
    .filter((item) => item.incomeType === 'COUPON')
    .reduce((sum, item) => sum + item.amountCzk, 0)

  const interestIncomeCzk = incomes
    .filter((item) => item.incomeType === 'INTEREST')
    .reduce((sum, item) => sum + item.amountCzk, 0)

  const investmentIncomeCzk = dividendIncomeCzk + couponIncomeCzk + interestIncomeCzk

  if (
    input.startMarketValueCzk === null ||
    input.endMarketValueCzk === null ||
    input.quality === 'UNAVAILABLE'
  ) {
    return {
      instrumentId: input.instrumentId,
      instrumentName: input.instrumentName,
      period: input.period,
      startDate,
      endDate: input.endDate,
      startMarketValueCzk: input.startMarketValueCzk,
      endMarketValueCzk: input.endMarketValueCzk,
      buyCashCzk,
      sellCashCzk,
      dividendIncomeCzk,
      couponIncomeCzk,
      interestIncomeCzk,
      investmentIncomeCzk,
      profitCzk: null,
      returnPercent: null,
      quality: 'UNAVAILABLE',
      reason: input.qualityReason ?? 'Chybí ocenění na hranici období.',
    }
  }

  // Ekonomický zisk období: konečná hodnota + hotovost z prodejů + příjmy
  // minus počáteční hodnota a nový kapitál vložený do nákupů během období.
  const profitCzk =
    input.endMarketValueCzk +
    sellCashCzk +
    investmentIncomeCzk -
    input.startMarketValueCzk -
    buyCashCzk

  // Modified-Dietz bez přesného vážení toků. Vhodné jako period Total Return approximation,
  // nikoli náhrada TWR/XIRR, dokud nejsou kompletní externí cashflow a denní valuace.
  const capitalBase = input.startMarketValueCzk + buyCashCzk
  const returnPercent = capitalBase > 0 ? (profitCzk / capitalBase) * 100 : null

  return {
    instrumentId: input.instrumentId,
    instrumentName: input.instrumentName,
    period: input.period,
    startDate,
    endDate: input.endDate,
    startMarketValueCzk: input.startMarketValueCzk,
    endMarketValueCzk: input.endMarketValueCzk,
    buyCashCzk,
    sellCashCzk,
    dividendIncomeCzk,
    couponIncomeCzk,
    interestIncomeCzk,
    investmentIncomeCzk,
    profitCzk,
    returnPercent,
    quality: input.quality,
    reason: input.qualityReason,
  }
}

export function aggregatePortfolioPeriodReturns(rows: InstrumentPeriodReturn[]) {
  const available = rows.filter((row) => row.profitCzk !== null)
  const startMarketValueCzk = available.reduce((sum, row) => sum + (row.startMarketValueCzk ?? 0), 0)
  const endMarketValueCzk = available.reduce((sum, row) => sum + (row.endMarketValueCzk ?? 0), 0)
  const buyCashCzk = available.reduce((sum, row) => sum + row.buyCashCzk, 0)
  const sellCashCzk = available.reduce((sum, row) => sum + row.sellCashCzk, 0)
  const dividendIncomeCzk = rows.reduce((sum, row) => sum + row.dividendIncomeCzk, 0)
  const couponIncomeCzk = rows.reduce((sum, row) => sum + row.couponIncomeCzk, 0)
  const interestIncomeCzk = rows.reduce((sum, row) => sum + row.interestIncomeCzk, 0)
  const investmentIncomeCzk = dividendIncomeCzk + couponIncomeCzk + interestIncomeCzk
  const profitCzk = available.reduce((sum, row) => sum + (row.profitCzk ?? 0), 0)
  const capitalBase = startMarketValueCzk + buyCashCzk

  const quality: PerformanceQuality = rows.some((row) => row.quality === 'UNAVAILABLE')
    ? 'PARTIAL'
    : rows.some((row) => row.quality === 'PARTIAL')
      ? 'PARTIAL'
      : 'FULL'

  return {
    startMarketValueCzk,
    endMarketValueCzk,
    buyCashCzk,
    sellCashCzk,
    dividendIncomeCzk,
    couponIncomeCzk,
    interestIncomeCzk,
    investmentIncomeCzk,
    profitCzk,
    returnPercent: capitalBase > 0 ? (profitCzk / capitalBase) * 100 : null,
    quality,
    unavailableInstrumentCount: rows.filter((row) => row.quality === 'UNAVAILABLE').length,
    partialInstrumentCount: rows.filter((row) => row.quality === 'PARTIAL').length,
  }
}
