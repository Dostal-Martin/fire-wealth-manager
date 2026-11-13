import { describe, expect, it } from 'vitest'
import {
  calculateFundingRatio,
  calculateRequiredStartingCapital,
  calculateRetirementProjection,
  type RetirementPlanInput,
} from './retirementPlan'

function plan(overrides: Partial<RetirementPlanInput> = {}): RetirementPlanInput {
  return {
    startAgeYears: 54,
    startAgeMonths: 0,
    endAgeYears: 84,
    endAgeMonths: 0,
    monthlyIncomeTargetCzk: 100_000,
    nominalReturnRate: 0,
    inflationRate: 0,
    pensionStartAgeYears: 66,
    pensionStartAgeMonths: 0,
    monthlyPensionCzk: 0,
    incomeIndexed: false,
    terminalCapitalCzk: 0,
    withdrawalStrategy: 'TARGET_DEPLETION',
    events: [],
    ...overrides,
  }
}

describe('retirement plan', () => {
  it('spočítá 30 let bez výnosu jako 36 mil. Kč', () => {
    expect(calculateRequiredStartingCapital(plan())).toBeCloseTo(36_000_000, 0)
  })

  it('státní důchod snižuje potřebný kapitál', () => {
    const withoutPension = calculateRequiredStartingCapital(plan())
    const withPension = calculateRequiredStartingCapital(plan({ monthlyPensionCzk: 20_000 }))
    expect(withPension).toBeLessThan(withoutPension)
  })

  it('terminální kapitál zvyšuje potřebný startovní kapitál', () => {
    const zero = calculateRequiredStartingCapital(plan())
    const buffer = calculateRequiredStartingCapital(plan({ terminalCapitalCzk: 2_000_000 }))
    expect(buffer).toBeGreaterThan(zero)
  })

  it('jednorázový výdaj zvyšuje potřebný kapitál', () => {
    const base = calculateRequiredStartingCapital(plan())
    const withCar = calculateRequiredStartingCapital(plan({ events: [{ ageYears: 60, ageMonths: 0, amountCzk: 800_000, description: 'Auto', inflationIndexed: false, enabled: true }] }))
    expect(withCar).toBeGreaterThan(base)
  })

  it('reverzní výpočet končí na zadaném terminálním kapitálu', () => {
    const input = plan({ nominalReturnRate: 0.05, inflationRate: 0.025, incomeIndexed: true, monthlyPensionCzk: 20_000, terminalCapitalCzk: 2_000_000 })
    const required = calculateRequiredStartingCapital(input)
    const projection = calculateRetirementProjection(required, input)
    expect(projection.finalCapitalCzk).toBeCloseTo(2_000_000, 2)
  })

  it('funding ratio je kapitál dělený potřebným kapitálem', () => {
    expect(calculateFundingRatio(18_000_000, 24_000_000)).toBeCloseTo(0.75)
  })
})
