import { describe, expect, it } from 'vitest'
import { calculateCoupledFirePlan, projectCapitalAtMonth } from './coupledFirePlan'
import type { RetirementPlanInput } from './retirementPlan'

const basePlan: RetirementPlanInput = {
  startAgeYears: 54,
  startAgeMonths: 2,
  endAgeYears: 90,
  endAgeMonths: 0,
  monthlyIncomeTargetCzk: 100_000,
  nominalReturnRate: 0.04,
  inflationRate: 0.025,
  pensionStartAgeYears: 65,
  pensionStartAgeMonths: 0,
  monthlyPensionCzk: 25_000,
  incomeIndexed: true,
  terminalCapitalCzk: 0,
  withdrawalStrategy: 'FIXED_REAL',
  events: [],
}

describe('coupled FIRE plan', () => {
  it('počítá kapitál ke konkrétnímu měsíci s fixním nominálním vkladem', () => {
    const capital = projectCapitalAtMonth(16_836_923, 100_000, 0.07, 0.025, 47)
    expect(capital).toBeGreaterThan(24_000_000)
    expect(capital).toBeLessThan(25_100_000)
  })

  it('porovnává projektovaný a potřebný kapitál ke stejnému datu', () => {
    const result = calculateCoupledFirePlan({
      currentCapitalCzk: 16_836_923,
      currentAgeYears: 50,
      currentAgeMonths: 3,
      plannedStartAgeYears: 54,
      plannedStartAgeMonths: 2,
      monthlyContributionCzk: 100_000,
      accumulationNominalReturnRate: 0.07,
      inflationRate: 0.025,
      retirementPlan: basePlan,
      calculationDate: new Date('2026-11-14T12:00:00Z'),
    })

    expect(result.plannedMonths).toBe(47)
    expect(result.requiredCapitalAtPlannedDateCzk).toBeGreaterThan(0)
    expect(result.projectedCapitalAtPlannedDateCzk).toBeGreaterThan(0)
    expect(result.sustainableMonthlyIncomeAtPlannedDateCzk).toBeGreaterThan(0)
    expect(result.requiredMonthlyContributionCzk).toBeGreaterThanOrEqual(0)
  })

  it('pozdější odchod zkracuje rentovou fázi a nemá zvyšovat potřebný kapitál', () => {
    const earlier = calculateCoupledFirePlan({
      currentCapitalCzk: 10_000_000,
      currentAgeYears: 50,
      currentAgeMonths: 0,
      plannedStartAgeYears: 55,
      plannedStartAgeMonths: 0,
      monthlyContributionCzk: 0,
      accumulationNominalReturnRate: 0,
      inflationRate: 0,
      retirementPlan: basePlan,
    })
    const later = calculateCoupledFirePlan({
      currentCapitalCzk: 10_000_000,
      currentAgeYears: 50,
      currentAgeMonths: 0,
      plannedStartAgeYears: 60,
      plannedStartAgeMonths: 0,
      monthlyContributionCzk: 0,
      accumulationNominalReturnRate: 0,
      inflationRate: 0,
      retirementPlan: basePlan,
    })

    expect(later.requiredCapitalAtPlannedDateCzk)
      .toBeLessThanOrEqual(earlier.requiredCapitalAtPlannedDateCzk)
  })
})
