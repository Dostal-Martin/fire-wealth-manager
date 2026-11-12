import { describe, expect, it } from 'vitest'
import { calculatePricePeriod } from './performanceHistory'

describe('calculatePricePeriod', () => {
  it('počítá plný YTD výnos', () => {
    const result = calculatePricePeriod('YTD', [
      { date: '2026-01-01', value: 100 },
      { date: '2026-11-12', value: 120 },
    ])
    expect(result.quality).toBe('FULL')
    expect(result.priceReturnPercent).toBeCloseTo(20, 10)
  })

  it('označí CSG YTD jako částečné, pokud historie začne později', () => {
    const result = calculatePricePeriod('YTD', [
      { date: '2026-01-23', value: 10 },
      { date: '2026-11-11', value: 12 },
    ])
    expect(result.quality).toBe('PARTIAL')
    expect(result.effectiveStartDate).toBe('2026-01-23')
  })

  it('nepředstírá výnos při jediném ocenění', () => {
    const result = calculatePricePeriod('1Y', [
      { date: '2026-11-10', value: 100 },
    ])
    expect(result.quality).toBe('UNAVAILABLE')
    expect(result.priceReturnPercent).toBeNull()
  })
})
