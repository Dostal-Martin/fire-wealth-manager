import { describe, expect, it } from 'vitest'
import {
  validateExternalCashflow,
  type ExternalCashflowInput,
} from './externalCashflow'

function input(overrides: Partial<ExternalCashflowInput> = {}): ExternalCashflowInput {
  return {
    cashInstrumentId: 'cash-czk',
    transactionDate: '2026-11-12',
    transactionType: 'DEPOSIT',
    amountNative: 25_000,
    currency: 'CZK',
    fxRate: 1,
    note: '',
    ...overrides,
  }
}

describe('validateExternalCashflow v2', () => {
  it('povolí CZK vklad', () => {
    const result = validateExternalCashflow(input())
    expect(result.valid).toBe(true)
    expect(result.amountCzk).toBe(25_000)
  })

  it('povolí USD vklad a přepočítá CZK protihodnotu', () => {
    const result = validateExternalCashflow(input({
      cashInstrumentId: 'cash-usd',
      amountNative: 1_000,
      currency: 'USD',
      fxRate: 22,
    }))
    expect(result.valid).toBe(true)
    expect(result.amountCzk).toBe(22_000)
  })

  it('povolí výběr a ponechá kladnou absolutní hodnotu pro RPC', () => {
    const result = validateExternalCashflow(input({
      transactionType: 'WITHDRAWAL',
      amountNative: 25_000,
    }))
    expect(result.valid).toBe(true)
    expect(result.amountCzk).toBe(25_000)
  })

  it('odmítne chybějící hotovostní účet', () => {
    const result = validateExternalCashflow(input({ cashInstrumentId: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Vyberte hotovostní účet.')
  })

  it('odmítne nulovou částku', () => {
    const result = validateExternalCashflow(input({ amountNative: 0 }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Částka musí být větší než nula.')
  })
})
