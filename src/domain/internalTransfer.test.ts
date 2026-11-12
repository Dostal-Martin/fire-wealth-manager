import { describe, expect, it } from 'vitest'
import { validateInternalTransfer, type InternalTransferInput } from './internalTransfer'

function input(overrides: Partial<InternalTransferInput> = {}): InternalTransferInput {
  return {
    transferDate: '2026-11-12',
    sourceInstrumentId: 'cash-czk',
    destinationInstrumentId: 'savings',
    sourceAmount: 100_000,
    destinationAmount: 100_000,
    sourceValueCzk: 100_000,
    destinationValueCzk: 100_000,
    feeCzk: 0,
    note: '',
    ...overrides,
  }
}

describe('validateInternalTransfer', () => {
  it('povolí CZK převod bez změny čistého jmění', () => {
    expect(validateInternalTransfer(input()).valid).toBe(true)
  })

  it('povolí FX převod se samostatnými zdrojovými a cílovými jednotkami', () => {
    expect(validateInternalTransfer(input({
      destinationInstrumentId: 'cash-eur',
      sourceAmount: 24_400,
      destinationAmount: 1_000,
      sourceValueCzk: 24_400,
      destinationValueCzk: 24_390,
      feeCzk: 10,
    })).valid).toBe(true)
  })

  it('odmítne stejný zdroj a cíl', () => {
    const result = validateInternalTransfer(input({ destinationInstrumentId: 'cash-czk' }))
    expect(result.valid).toBe(false)
  })

  it('odmítne nesedící korunové hodnoty', () => {
    const result = validateInternalTransfer(input({ destinationValueCzk: 90_000 }))
    expect(result.valid).toBe(false)
  })
})
