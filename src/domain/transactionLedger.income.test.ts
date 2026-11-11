import { describe, expect, it } from 'vitest'
import { aggregateInvestmentIncome, calculateInstrumentLedger, calculateInvestmentPerformance, type InvestmentIncome, type LedgerTransaction } from './transactionLedger'

function transaction(overrides: Partial<LedgerTransaction> = {}): LedgerTransaction {
  return { id: 'buy-1', portfolioId: 'p1', instrumentId: 'i1', transactionDate: '2026-01-01', transactionType: 'BUY', quantity: 100, unitPrice: 500, currency: 'CZK', fxRate: 1, feesCzk: 0, taxCzk: 0, amountCzk: 50000, ...overrides }
}

describe('aggregateInvestmentIncome', () => {
  it('sečte dividendy a kupóny podle instrumentu', () => {
    const rows: InvestmentIncome[] = [
      { id: 'd1', instrumentId: 'i1', transactionDate: '2025-01-01', incomeType: 'DIVIDEND', amountCzk: 1000 },
      { id: 'd2', instrumentId: 'i1', transactionDate: '2025-02-01', incomeType: 'DIVIDEND', amountCzk: 2000 },
      { id: 'c1', instrumentId: 'i1', transactionDate: '2025-03-01', incomeType: 'COUPON', amountCzk: 500 },
    ]
    const result = aggregateInvestmentIncome(rows).get('i1')
    expect(result?.dividendIncomeCzk).toBe(3000)
    expect(result?.couponIncomeCzk).toBe(500)
    expect(result?.investmentIncomeCzk).toBe(3500)
    expect(result?.incomeCount).toBe(3)
  })

  it('zachová dvě skutečné dividendy ve stejný den', () => {
    const rows: InvestmentIncome[] = [
      { id: 'broker-a', instrumentId: 'tabak', transactionDate: '2025-07-14', incomeType: 'DIVIDEND', amountCzk: 10370 },
      { id: 'broker-b', instrumentId: 'tabak', transactionDate: '2025-07-14', incomeType: 'DIVIDEND', amountCzk: 10370 },
    ]
    expect(aggregateInvestmentIncome(rows).get('tabak')?.dividendIncomeCzk).toBe(20740)
  })

  it('oddělí příjmy různých instrumentů', () => {
    const rows: InvestmentIncome[] = [
      { id: 'a', instrumentId: 'i1', transactionDate: '2025-01-01', incomeType: 'DIVIDEND', amountCzk: 100 },
      { id: 'b', instrumentId: 'i2', transactionDate: '2025-01-01', incomeType: 'COUPON', amountCzk: 200 },
    ]
    const result = aggregateInvestmentIncome(rows)
    expect(result.get('i1')?.investmentIncomeCzk).toBe(100)
    expect(result.get('i2')?.investmentIncomeCzk).toBe(200)
  })
})

describe('calculateInvestmentPerformance with income', () => {
  it('zahrne dividendy a kupóny do celkového výsledku', () => {
    const ledger = calculateInstrumentLedger([transaction()])
    const result = calculateInvestmentPerformance(ledger, 60000, { instrumentId: 'i1', dividendIncomeCzk: 3000, couponIncomeCzk: 2000, investmentIncomeCzk: 5000, incomeCount: 2 })
    expect(result.unrealizedProfitLossCzk).toBe(10000)
    expect(result.investmentIncomeCzk).toBe(5000)
    expect(result.totalProfitLossCzk).toBe(15000)
    expect(result.totalReturnPercent).toBeCloseTo(30, 10)
  })

  it('spojí realizovaný, nerealizovaný a příjmový výsledek', () => {
    const ledger = calculateInstrumentLedger([
      transaction(),
      transaction({ id: 'sell-1', transactionDate: '2026-02-01', transactionType: 'SELL', quantity: 40, amountCzk: 28000 }),
    ])
    const result = calculateInvestmentPerformance(ledger, 36000, { instrumentId: 'i1', dividendIncomeCzk: 1000, couponIncomeCzk: 500, investmentIncomeCzk: 1500, incomeCount: 2 })
    expect(result.realizedProfitLossCzk).toBe(8000)
    expect(result.unrealizedProfitLossCzk).toBe(6000)
    expect(result.totalProfitLossCzk).toBe(15500)
  })
})
