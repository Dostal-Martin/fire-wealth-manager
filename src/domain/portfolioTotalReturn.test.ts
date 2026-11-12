import { describe, expect, it } from 'vitest'
import {
  aggregatePortfolioPeriodReturns,
  calculateInstrumentPeriodReturn,
} from './portfolioTotalReturn'

describe('calculateInstrumentPeriodReturn', () => {
  it('zahrne změnu hodnoty, nákupy, prodeje a dividendy', () => {
    const result = calculateInstrumentPeriodReturn({
      instrumentId: 'i1',
      instrumentName: 'Test',
      period: 'YTD',
      requestedStartDate: '2026-01-01',
      effectiveStartDate: '2026-01-01',
      endDate: '2026-11-12',
      startMarketValueCzk: 100_000,
      endMarketValueCzk: 160_000,
      transactions: [
        { transactionDate: '2026-02-01', transactionType: 'BUY', quantity: 10, amountCzk: 50_000 },
        { transactionDate: '2026-06-01', transactionType: 'SELL', quantity: 5, amountCzk: 35_000 },
      ],
      incomes: [
        { transactionDate: '2026-07-01', incomeType: 'DIVIDEND', amountCzk: 5_000 },
      ],
      quality: 'FULL',
      qualityReason: null,
    })

    expect(result.profitCzk).toBe(50_000)
    expect(result.returnPercent).toBeCloseTo(33.333333, 5)
    expect(result.investmentIncomeCzk).toBe(5_000)
  })

  it('nepředstírá výnos bez počátečního ocenění', () => {
    const result = calculateInstrumentPeriodReturn({
      instrumentId: 'i1', instrumentName: 'Test', period: '1Y',
      requestedStartDate: '2025-11-12', effectiveStartDate: null, endDate: '2026-11-12',
      startMarketValueCzk: null, endMarketValueCzk: 100_000,
      transactions: [], incomes: [], quality: 'UNAVAILABLE', qualityReason: 'Chybí ocenění.',
    })
    expect(result.profitCzk).toBeNull()
    expect(result.returnPercent).toBeNull()
  })
})

describe('aggregatePortfolioPeriodReturns', () => {
  it('agreguje dostupné instrumenty a označí částečnou kvalitu', () => {
    const available = calculateInstrumentPeriodReturn({
      instrumentId: 'a', instrumentName: 'A', period: 'YTD', requestedStartDate: '2026-01-01', effectiveStartDate: '2026-01-01', endDate: '2026-11-12', startMarketValueCzk: 100, endMarketValueCzk: 110, transactions: [], incomes: [], quality: 'FULL', qualityReason: null,
    })
    const missing = calculateInstrumentPeriodReturn({
      instrumentId: 'b', instrumentName: 'B', period: 'YTD', requestedStartDate: '2026-01-01', effectiveStartDate: null, endDate: '2026-11-12', startMarketValueCzk: null, endMarketValueCzk: 50, transactions: [], incomes: [], quality: 'UNAVAILABLE', qualityReason: 'Chybí historie.',
    })

    const result = aggregatePortfolioPeriodReturns([available, missing])
    expect(result.profitCzk).toBe(10)
    expect(result.quality).toBe('PARTIAL')
    expect(result.unavailableInstrumentCount).toBe(1)
  })
})
