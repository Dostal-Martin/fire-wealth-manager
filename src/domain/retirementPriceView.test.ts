import { describe, expect, it } from 'vitest'
import {
  calculateInflationFactor,
  calculateMonthsToRetirement,
  calculateRetirementPriceView,
  toNominalFutureCzk,
  toTodayCzk,
} from './retirementPriceView'

describe('retirement price view', () => {
  it('počítá horizont včetně měsíců', () => {
    expect(calculateMonthsToRetirement(44, 6, 54, 0)).toBe(114)
  })

  it('nepoužívá záporný horizont', () => {
    expect(calculateMonthsToRetirement(55, 0, 54, 0)).toBe(0)
  })

  it('při nulové inflaci zachová částku', () => {
    expect(toNominalFutureCzk(15_000_000, 0, 120)).toBe(15_000_000)
  })

  it('po 12 měsících použije celý roční inflační faktor', () => {
    expect(calculateInflationFactor(0.025, 12)).toBeCloseTo(1.025, 12)
  })

  it('počítá necelé roky po měsících', () => {
    expect(calculateInflationFactor(0.03, 18)).toBeCloseTo(Math.pow(1.03, 1.5), 12)
  })

  it('převod budoucí částky zpět do dnešních cen je reverzní', () => {
    const future = toNominalFutureCzk(60_000, 0.025, 120)
    expect(toTodayCzk(future, 0.025, 120)).toBeCloseTo(60_000, 8)
  })

  it('vrací dvojí pohled na cíl, rentu a terminální kapitál', () => {
    const result = calculateRetirementPriceView({
      currentAgeYears: 44,
      currentAgeMonths: 0,
      retirementStartAgeYears: 54,
      retirementStartAgeMonths: 0,
      inflationRate: 0.025,
      fireTargetTodayCzk: 15_000_000,
      monthlyIncomeTodayCzk: 60_000,
      terminalCapitalTodayCzk: 2_000_000,
    })

    expect(result.monthsToRetirement).toBe(120)
    expect(result.fireTargetAtRetirementCzk).toBeCloseTo(19_201_268, 0)
    expect(result.monthlyIncomeAtRetirementCzk).toBeCloseTo(76_805, 0)
    expect(result.terminalCapitalAtRetirementCzk).toBeCloseTo(2_560_169, 0)
  })

  it('odmítne inflaci -100 % a nižší', () => {
    expect(() => calculateInflationFactor(-1, 12)).toThrow(
      'Inflace musí být větší než -100 %.',
    )
  })
})
