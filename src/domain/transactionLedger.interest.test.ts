import { describe, expect, it } from 'vitest'
import {
  aggregateInvestmentIncome,
  calculateInstrumentLedger,
  calculateInvestmentPerformance,
  type InvestmentIncome,
  type LedgerTransaction,
} from './transactionLedger'

function transaction(overrides: Partial<LedgerTransaction> = {}): LedgerTransaction {
  return {
    id: 'buy-1', portfolioId: 'p1', instrumentId: 'i1', transactionDate: '2026-01-01',
    transactionType: 'BUY', quantity: 100, unitPrice: 500, currency: 'CZK', fxRate: 1,
    feesCzk: 0, taxCzk: 0, amountCzk: 50_000, ...overrides,
  }
}

describe('INTEREST', () => {
  it('agreguje dividendy, kupóny a úroky odděleně', () => {
    const rows: InvestmentIncome[] = [
      { id: 'd1', instrumentId: 'i1', transactionDate: '2026-01-01', incomeType: 'DIVIDEND', amountCzk: 1_000 },
      { id: 'c1', instrumentId: 'i1', transactionDate: '2026-02-01', incomeType: 'COUPON', amountCzk: 2_000 },
      { id: 'i1', instrumentId: 'i1', transactionDate: '2026-03-01', incomeType: 'INTEREST', amountCzk: 3_000 },
    ]
    const result = aggregateInvestmentIncome(rows).get('i1')
    expect(result?.dividendIncomeCzk).toBe(1_000)
    expect(result?.couponIncomeCzk).toBe(2_000)
    expect(result?.interestIncomeCzk).toBe(3_000)
    expect(result?.investmentIncomeCzk).toBe(6_000)
  })

  it('zahrne úroky do celkového investičního výsledku', () => {
    const ledger = calculateInstrumentLedger([transaction()])
    const result = calculateInvestmentPerformance(ledger, 55_000, {
      instrumentId: 'i1', dividendIncomeCzk: 0, couponIncomeCzk: 0,
      interestIncomeCzk: 2_500, investmentIncomeCzk: 2_500, incomeCount: 1,
    })
    expect(result.unrealizedProfitLossCzk).toBe(5_000)
    expect(result.interestIncomeCzk).toBe(2_500)
    expect(result.totalProfitLossCzk).toBe(7_500)
    expect(result.totalReturnPercent).toBeCloseTo(15, 10)
  })
})
