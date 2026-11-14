import { describe, expect, it } from 'vitest'
import {
  annualToMonthlyRate,
  calculateAccumulation,
  calculateRealReturn,
  calculateRent,
  formatAge,
  realContributionForMonth,
} from './fireCalculations'

describe('calculateRealReturn', () => {
  it('počítá reálný výnos geometricky', () => {
    expect(calculateRealReturn(0.07, 0.025)).toBeCloseTo(0.043902439, 8)
  })
})

describe('annualToMonthlyRate', () => {
  it('měsíční skládání odpovídá roční sazbě', () => {
    const monthlyRate = annualToMonthlyRate(0.12)
    expect(Math.pow(1 + monthlyRate, 12) - 1).toBeCloseTo(0.12, 10)
  })
})

describe('calculateAccumulation', () => {
  it('dosáhne cíle pouze pomocí vkladů při nulovém výnosu a inflaci', () => {
    const result = calculateAccumulation({
      startCapital: 1_000_000,
      monthlyContribution: 100_000,
      targetCapital: 1_500_000,
      nominalReturn: 0,
      inflation: 0,
      currentAgeMonths: 40 * 12,
      calculationDate: new Date('2026-01-01T12:00:00Z'),
    })

    expect(result.months).toBe(5)
    expect(result.finalCapital).toBeCloseTo(1_500_000, 2)
    expect(result.targetReached).toBe(true)
  })

  it('fixní nominální vklad v reálné projekci s inflací postupně klesá', () => {
    expect(realContributionForMonth(100_000, 0.025, 12, 'FIXED_NOMINAL'))
      .toBeCloseTo(97_560.98, 2)
    expect(realContributionForMonth(100_000, 0.025, 48, 'FIXED_NOMINAL'))
      .toBeCloseTo(90_595.06, 2)
  })

  it('fixní reálný vklad zůstává v dnešní kupní síle konstantní', () => {
    expect(realContributionForMonth(100_000, 0.025, 48, 'FIXED_REAL')).toBe(100_000)
  })

  it('u aktuálního příkladu neposouvá fixní nominální vklady do reálných 100 000 Kč', () => {
    const result = calculateAccumulation({
      startCapital: 16_836_923,
      monthlyContribution: 100_000,
      targetCapital: 24_956_699,
      nominalReturn: 0.07,
      inflation: 0.025,
      currentAgeMonths: 50 * 12 + 3,
      calculationDate: new Date('2026-11-14T12:00:00Z'),
    })

    expect(result.months).toBeGreaterThan(47)
    expect(result.targetReached).toBe(true)
  })
})

describe('calculateRent', () => {
  it('při nulovém výnosu odečítá pravidelnou rentu', () => {
    const result = calculateRent({
      startCapital: 1_200_000,
      startAgeMonths: 60 * 12,
      monthlyRent: 100_000,
      nominalReturn: 0,
      inflation: 0,
      years: 1,
      pensionAge: 99,
      pensionAmount: 0,
      indexation: false,
      dynamic: false,
    })

    expect(result.endingCapital).toBeCloseTo(0, 2)
    expect(result.totalWithdrawn).toBeCloseTo(1_200_000, 2)
  })
})

describe('formatAge', () => {
  it('formátuje celé roky', () => {
    expect(formatAge(35 * 12)).toBe('35 let')
  })

  it('formátuje roky a měsíce', () => {
    expect(formatAge(35 * 12 + 7)).toBe('35 let 7 měs.')
  })
})
