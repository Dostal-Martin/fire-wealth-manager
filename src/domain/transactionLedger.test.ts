import { describe, expect, it } from 'vitest'
import {
  calculateInstrumentLedger,
  calculateInvestmentPerformance,
  calculateLedgerByInstrument,
  reconcileLedgerQuantity,
  reconcileLedgerWithPositions,
  type LedgerTransaction,
} from './transactionLedger'

function createTransaction(overrides: Partial<LedgerTransaction> = {}): LedgerTransaction {
  return {
    id: 'transaction-1',
    portfolioId: 'portfolio-1',
    instrumentId: 'instrument-1',
    transactionDate: '2026-01-01',
    transactionType: 'BUY',
    quantity: 100,
    unitPrice: 500,
    currency: 'CZK',
    fxRate: 1,
    feesCzk: 0,
    taxCzk: 0,
    amountCzk: 50_000,
    createdAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('calculateInstrumentLedger', () => {
  it('spočítá jeden nákup', () => {
    const result = calculateInstrumentLedger([createTransaction()])
    expect(result.ledgerQuantity).toBe(100)
    expect(result.remainingCostBasisCzk).toBe(50_000)
    expect(result.averageCostCzk).toBe(500)
  })

  it('spočítá vážený průměr', () => {
    const result = calculateInstrumentLedger([
      createTransaction({ id: 'buy-1', quantity: 100, amountCzk: 50_000 }),
      createTransaction({ id: 'buy-2', transactionDate: '2026-02-01', quantity: 50, unitPrice: 600, amountCzk: 30_000 }),
    ])
    expect(result.ledgerQuantity).toBe(150)
    expect(result.remainingCostBasisCzk).toBe(80_000)
    expect(result.averageCostCzk).toBeCloseTo(533.333333, 6)
  })

  it('spočítá částečný prodej', () => {
    const result = calculateInstrumentLedger([
      createTransaction({ id: 'buy-1' }),
      createTransaction({ id: 'sell-1', transactionDate: '2026-02-01', transactionType: 'SELL', quantity: 40, unitPrice: 700, amountCzk: 28_000 }),
    ])
    expect(result.ledgerQuantity).toBe(60)
    expect(result.remainingCostBasisCzk).toBe(30_000)
    expect(result.realizedProfitLossCzk).toBe(8_000)
  })

  it('odmítne prodej nad dostupné množství', () => {
    const result = calculateInstrumentLedger([
      createTransaction(),
      createTransaction({ id: 'sell-1', transactionDate: '2026-02-01', transactionType: 'SELL', quantity: 120, amountCzk: 60_000 }),
    ])
    expect(result.ledgerQuantity).toBe(100)
    expect(result.invalidTransactionCount).toBe(1)
    expect(result.issues[0].code).toBe('OVERSOLD_POSITION')
  })
})

describe('calculateInvestmentPerformance', () => {
  it('spočítá nerealizovaný zisk', () => {
    const ledger = calculateInstrumentLedger([createTransaction()])
    const result = calculateInvestmentPerformance(ledger, 60_000)
    expect(result.unrealizedProfitLossCzk).toBe(10_000)
    expect(result.unrealizedReturnPercent).toBeCloseTo(20, 10)
    expect(result.totalProfitLossCzk).toBe(10_000)
  })

  it('spojí realizovaný a nerealizovaný výsledek', () => {
    const ledger = calculateInstrumentLedger([
      createTransaction({ id: 'buy-1' }),
      createTransaction({ id: 'sell-1', transactionDate: '2026-02-01', transactionType: 'SELL', quantity: 40, amountCzk: 28_000 }),
    ])
    const result = calculateInvestmentPerformance(ledger, 36_000)
    expect(result.unrealizedProfitLossCzk).toBe(6_000)
    expect(result.realizedProfitLossCzk).toBe(8_000)
    expect(result.totalProfitLossCzk).toBe(14_000)
  })

  it('spočítá jednoduchý celkový obchodní výnos', () => {
    const ledger = calculateInstrumentLedger([createTransaction()])
    const result = calculateInvestmentPerformance(ledger, 55_000)
    expect(result.totalReturnPercent).toBeCloseTo(10, 10)
  })
})

describe('calculateLedgerByInstrument', () => {
  it('oddělí instrumenty', () => {
    const result = calculateLedgerByInstrument([
      createTransaction({ instrumentId: 'instrument-1' }),
      createTransaction({ id: 'transaction-2', instrumentId: 'instrument-2', quantity: 25, amountCzk: 25_000 }),
    ])
    expect(result).toHaveLength(2)
  })
})

describe('reconciliation', () => {
  it('vrací MATCH při shodě', () => {
    expect(reconcileLedgerQuantity('instrument-1', 100, 100).status).toBe('MATCH')
  })

  it('používá toleranci 0,01', () => {
    expect(reconcileLedgerQuantity('instrument-1', 2237.804, 2237.8).status).toBe('MATCH')
  })

  it('vrací MISMATCH nad tolerancí', () => {
    expect(reconcileLedgerQuantity('instrument-1', 400, 0).status).toBe('MISMATCH')
  })

  it('zahrne pozici bez transakcí', () => {
    const reconciliations = reconcileLedgerWithPositions(
      [calculateInstrumentLedger([createTransaction()])],
      [
        { instrumentId: 'instrument-1', quantity: 100 },
        { instrumentId: 'instrument-2', quantity: 50 },
      ],
    )
    expect(reconciliations.find((row) => row.instrumentId === 'instrument-2')?.status).toBe('NO_LEDGER')
  })
})
