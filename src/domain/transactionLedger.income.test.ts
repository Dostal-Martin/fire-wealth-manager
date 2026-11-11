import { describe, expect, it } from 'vitest'
import {
  aggregateInvestmentIncome,
  calculateInstrumentLedger,
  calculateInvestmentPerformance,
  type InvestmentIncome,
  type LedgerTransaction,
} from './transactionLedger'

function createTransaction(
  overrides: Partial<LedgerTransaction> = {}
): LedgerTransaction {
  return {
    id: 'buy-1',
    portfolioId: 'p1',
    instrumentId: 'i1',
    transactionDate: '2026-01-01',
    transactionType: 'BUY',
    quantity: 100,
    unitPrice: 500,
    currency: 'CZK',
    fxRate: 1,
    feesCzk: 0,
    taxCzk: 0,
    amountCzk: 50_000,
    ...overrides,
  }
}

describe('aggregateInvestmentIncome', () => {
  it('sečte dividendy a kupóny podle instrumentu', () => {
    const rows: InvestmentIncome[] = [
      { id: 'd1', instrumentId: 'i1', transactionDate: '2025-01-01', incomeType: 'DIVIDEND', amountCzk: 1_000 },
      { id: 'd2', instrumentId: 'i1', transactionDate: '2025-02-01', incomeType: 'DIVIDEND', amountCzk: 2_000 },
      { id: 'c1', instrumentId: 'i1', transactionDate: '2025-03-01', incomeType: 'COUPON', amountCzk: 500 },
    ]

    const result = aggregateInvestmentIncome(rows).get('i1')

    expect(result?.dividendIncomeCzk).toBe(3_000)
    expect(result?.couponIncomeCzk).toBe(500)
    expect(result?.interestIncomeCzk).toBe(0)
    expect(result?.investmentIncomeCzk).toBe(3_500)
    expect(result?.incomeCount).toBe(3)
  })

  it('zachová dvě skutečné dividendy ve stejný den', () => {
    const rows: InvestmentIncome[] = [
      { id: 'broker-a', instrumentId: 'tabak', transactionDate: '2025-07-14', incomeType: 'DIVIDEND', amountCzk: 10_370 },
      { id: 'broker-b', instrumentId: 'tabak', transactionDate: '2025-07-14', incomeType: 'DIVIDEND', amountCzk: 10_370 },
    ]

    const result = aggregateInvestmentIncome(rows).get('tabak')

    expect(result?.dividendIncomeCzk).toBe(20_740)
    expect(result?.couponIncomeCzk).toBe(0)
    expect(result?.interestIncomeCzk).toBe(0)
    expect(result?.investmentIncomeCzk).toBe(20_740)
    expect(result?.incomeCount).toBe(2)
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

  it('započítá INTEREST do investičních příjmů', () => {
    const rows: InvestmentIncome[] = [
      { id: 'interest-1', instrumentId: 'savings', transactionDate: '2026-01-31', incomeType: 'INTEREST', amountCzk: 1_250 },
      { id: 'interest-2', instrumentId: 'savings', transactionDate: '2026-02-28', incomeType: 'INTEREST', amountCzk: 1_300 },
    ]

    const result = aggregateInvestmentIncome(rows).get('savings')

    expect(result?.dividendIncomeCzk).toBe(0)
    expect(result?.couponIncomeCzk).toBe(0)
    expect(result?.interestIncomeCzk).toBe(2_550)
    expect(result?.investmentIncomeCzk).toBe(2_550)
    expect(result?.incomeCount).toBe(2)
  })
})

describe('calculateInvestmentPerformance', () => {
  it('zahrne dividendy a kupóny do celkového výsledku', () => {
    const ledger = calculateInstrumentLedger([
      createTransaction({ amountCzk: 50_000 }),
    ])

    const result = calculateInvestmentPerformance(
      ledger,
      60_000,
      {
        instrumentId: 'i1',
        dividendIncomeCzk: 3_000,
        couponIncomeCzk: 2_000,
        interestIncomeCzk: 0,
        investmentIncomeCzk: 5_000,
        incomeCount: 2,
      }
    )

    expect(result.unrealizedProfitLossCzk).toBe(10_000)
    expect(result.dividendIncomeCzk).toBe(3_000)
    expect(result.couponIncomeCzk).toBe(2_000)
    expect(result.interestIncomeCzk).toBe(0)
    expect(result.investmentIncomeCzk).toBe(5_000)
    expect(result.totalProfitLossCzk).toBe(15_000)
    expect(result.totalReturnPercent).toBeCloseTo(30, 10)
  })

  it('spojí realizovaný, nerealizovaný a příjmový výsledek', () => {
    const ledger = calculateInstrumentLedger([
      createTransaction({ id: 'buy-1', quantity: 100, amountCzk: 50_000 }),
      createTransaction({ id: 'sell-1', transactionDate: '2026-02-01', transactionType: 'SELL', quantity: 40, amountCzk: 28_000 }),
    ])

    const result = calculateInvestmentPerformance(
      ledger,
      36_000,
      {
        instrumentId: 'i1',
        dividendIncomeCzk: 1_000,
        couponIncomeCzk: 500,
        interestIncomeCzk: 0,
        investmentIncomeCzk: 1_500,
        incomeCount: 2,
      }
    )

    expect(result.realizedProfitLossCzk).toBe(8_000)
    expect(result.unrealizedProfitLossCzk).toBe(6_000)
    expect(result.investmentIncomeCzk).toBe(1_500)
    expect(result.totalProfitLossCzk).toBe(15_500)
  })

  it('zahrne úrok do celkového investičního výsledku', () => {
    const ledger = calculateInstrumentLedger([
      createTransaction({ amountCzk: 50_000 }),
    ])

    const result = calculateInvestmentPerformance(
      ledger,
      55_000,
      {
        instrumentId: 'i1',
        dividendIncomeCzk: 0,
        couponIncomeCzk: 0,
        interestIncomeCzk: 2_500,
        investmentIncomeCzk: 2_500,
        incomeCount: 1,
      }
    )

    expect(result.unrealizedProfitLossCzk).toBe(5_000)
    expect(result.interestIncomeCzk).toBe(2_500)
    expect(result.totalProfitLossCzk).toBe(7_500)
    expect(result.totalReturnPercent).toBeCloseTo(15, 10)
  })
})
