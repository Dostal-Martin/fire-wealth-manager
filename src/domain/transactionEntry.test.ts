import { describe, expect, it } from 'vitest'
import { validateManualTransaction, type ManualTransactionInput } from './transactionEntry'

function input(overrides: Partial<ManualTransactionInput> = {}): ManualTransactionInput {
  return {
    instrumentId: 'bac',
    cashInstrumentId: 'cash-usd',
    transactionDate: '2026-11-12',
    transactionType: 'BUY',
    quantity: 10,
    unitPrice: 50,
    currency: 'USD',
    fxRate: 22,
    feesNative: 1,
    taxNative: 0,
    note: '',
    ...overrides,
  }
}

describe('validateManualTransaction v2', () => {
  it('spočítá BUY v původní měně včetně poplatku', () => {
    const result = validateManualTransaction(input())
    expect(result.valid).toBe(true)
    expect(result.grossNative).toBe(500)
    expect(result.netNative).toBe(501)
    expect(result.amountCzk).toBe(11022)
  })

  it('spočítá čistý SELL', () => {
    const result = validateManualTransaction(input({
      transactionType: 'SELL',
      unitPrice: 55,
      feesNative: 1,
    }), 10)
    expect(result.valid).toBe(true)
    expect(result.netNative).toBe(549)
  })

  it('vyžaduje vypořádací účet', () => {
    const result = validateManualTransaction(input({ cashInstrumentId: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Vyberte vypořádací účet.')
  })

  it('odmítne prodej nad dostupné množství', () => {
    const result = validateManualTransaction(input({ transactionType: 'SELL', quantity: 11 }), 10)
    expect(result.valid).toBe(false)
  })
})
