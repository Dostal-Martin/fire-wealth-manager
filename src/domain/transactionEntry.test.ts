import { describe, expect, it } from 'vitest'
import {
  calculateManualTransactionAmount,
  validateManualTransaction,
  type ManualTransactionInput,
} from './transactionEntry'

function input(overrides: Partial<ManualTransactionInput> = {}): ManualTransactionInput {
  return {
    instrumentId: 'instrument-1',
    transactionDate: '2026-11-11',
    transactionType: 'BUY',
    quantity: 10,
    unitPrice: 100,
    currency: 'CZK',
    fxRate: 1,
    feesCzk: 20,
    taxCzk: 0,
    note: '',
    ...overrides,
  }
}

describe('calculateManualTransactionAmount', () => {
  it('u nákupu přičte poplatek a daň', () => {
    expect(calculateManualTransactionAmount(input({ taxCzk: 10 }))).toEqual({
      grossAmountCzk: 1_000,
      amountCzk: 1_030,
    })
  })

  it('u prodeje odečte poplatek a daň', () => {
    expect(calculateManualTransactionAmount(input({
      transactionType: 'SELL',
      feesCzk: 20,
      taxCzk: 30,
    }))).toEqual({
      grossAmountCzk: 1_000,
      amountCzk: 950,
    })
  })
})

describe('validateManualTransaction', () => {
  it('povolí platný nákup', () => {
    expect(validateManualTransaction(input(), null).valid).toBe(true)
  })

  it('povolí prodej do dostupného množství', () => {
    expect(validateManualTransaction(input({ transactionType: 'SELL', quantity: 5 }), 10).valid).toBe(true)
  })

  it('zakáže prodej nad dostupné množství', () => {
    const result = validateManualTransaction(input({ transactionType: 'SELL', quantity: 11 }), 10)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Nelze prodat')
  })

  it('odmítne neplatné hodnoty', () => {
    const result = validateManualTransaction(input({ quantity: 0, fxRate: 0, currency: 'Kč' }), null)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })
})
