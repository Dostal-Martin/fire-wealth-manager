import { describe, expect, it } from 'vitest'
import {
  validateInvestmentIncome,
  type InvestmentIncomeInput,
} from './investmentIncome'

function input(overrides: Partial<InvestmentIncomeInput> = {}): InvestmentIncomeInput {
  return {
    instrumentId: 'instrument-1',
    transactionDate: '2026-11-11',
    transactionType: 'DIVIDEND',
    amountCzk: 1_000,
    currency: 'CZK',
    fxRate: 1,
    note: '',
    ...overrides,
  }
}

describe('validateInvestmentIncome', () => {
  it('povolí dividendu', () => {
    expect(validateInvestmentIncome(input()).valid).toBe(true)
  })

  it('povolí kupón a úrok', () => {
    expect(validateInvestmentIncome(input({ transactionType: 'COUPON' })).valid).toBe(true)
    expect(validateInvestmentIncome(input({ transactionType: 'INTEREST' })).valid).toBe(true)
  })

  it('odmítne nulovou částku', () => {
    const result = validateInvestmentIncome(input({ amountCzk: 0 }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Částka musí být větší než nula.')
  })
})
