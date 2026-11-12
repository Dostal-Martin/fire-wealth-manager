import { describe, expect, it } from 'vitest'
import {
  validateInvestmentIncome,
  type InvestmentIncomeInput,
} from './investmentIncome'

function input(overrides: Partial<InvestmentIncomeInput> = {}): InvestmentIncomeInput {
  return {
    instrumentId: 'instrument-1',
    cashInstrumentId: 'cash-czk',
    transactionDate: '2026-11-12',
    transactionType: 'DIVIDEND',
    amountNative: 1_000,
    currency: 'CZK',
    fxRate: 1,
    taxNative: 0,
    feeNative: 0,
    note: '',
    ...overrides,
  }
}

describe('validateInvestmentIncome', () => {
  it('povolí dividendu, kupón a úrok s cílovým hotovostním účtem', () => {
    expect(validateInvestmentIncome(input()).valid).toBe(true)
    expect(validateInvestmentIncome(input({ transactionType: 'COUPON' })).valid).toBe(true)
    expect(validateInvestmentIncome(input({ transactionType: 'INTEREST' })).valid).toBe(true)
  })

  it('povolí USD dividendu po odečtení daně', () => {
    const result = validateInvestmentIncome(input({
      cashInstrumentId: 'cash-usd',
      currency: 'USD',
      amountNative: 100,
      taxNative: 15,
      fxRate: 22.01,
    }))
    expect(result.valid).toBe(true)
  })

  it('odmítne nulovou hrubou částku', () => {
    const result = validateInvestmentIncome(input({ amountNative: 0 }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Hrubá částka musí být větší než nula.')
  })

  it('odmítne chybějící cílový hotovostní účet', () => {
    const result = validateInvestmentIncome(input({ cashInstrumentId: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Vyberte cílový hotovostní účet.')
  })

  it('odmítne daň a poplatek vyšší než hrubý příjem', () => {
    const result = validateInvestmentIncome(input({
      amountNative: 100,
      taxNative: 90,
      feeNative: 20,
    }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Čistý příjem musí být větší než nula.')
  })
})
