import { describe, expect, it } from 'vitest'
import {
  getStoredExternalCashflowAmount,
  validateExternalCashflow,
  type ExternalCashflowInput,
} from './externalCashflow'

function input(
  overrides: Partial<ExternalCashflowInput> = {},
): ExternalCashflowInput {
  return {
    transactionDate: '2026-11-11',
    transactionType: 'DEPOSIT',
    amountCzk: 100_000,
    note: '',
    ...overrides,
  }
}

describe('getStoredExternalCashflowAmount', () => {
  it('uloží vklad kladně', () => {
    expect(getStoredExternalCashflowAmount('DEPOSIT', 100_000)).toBe(100_000)
  })

  it('uloží výběr záporně', () => {
    expect(getStoredExternalCashflowAmount('WITHDRAWAL', 100_000)).toBe(-100_000)
  })

  it('normalizuje omylem zápornou vstupní částku', () => {
    expect(getStoredExternalCashflowAmount('DEPOSIT', -100_000)).toBe(100_000)
    expect(getStoredExternalCashflowAmount('WITHDRAWAL', -100_000)).toBe(-100_000)
  })
})

describe('validateExternalCashflow', () => {
  it('povolí platný vklad', () => {
    const result = validateExternalCashflow(input())
    expect(result.valid).toBe(true)
    expect(result.storedAmountCzk).toBe(100_000)
  })

  it('povolí platný výběr', () => {
    const result = validateExternalCashflow(input({
      transactionType: 'WITHDRAWAL',
      amountCzk: 25_000,
    }))
    expect(result.valid).toBe(true)
    expect(result.storedAmountCzk).toBe(-25_000)
  })

  it('odmítne nulovou částku', () => {
    const result = validateExternalCashflow(input({ amountCzk: 0 }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Částka musí být větší než nula.')
  })

  it('odmítne neplatné datum', () => {
    const result = validateExternalCashflow(input({ transactionDate: '11.11.2026' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Zadejte platné datum.')
  })
})
