import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  annualToMonthlyRate,
  calculateAccumulation,
  calculateRealReturn,
  calculateRent,
  formatAge,
} from './fireCalculations'

describe(
  'calculateRealReturn',
  () => {
    it(
      'počítá reálný výnos geometricky',
      () => {
        const result =
          calculateRealReturn(
            0.07,
            0.025
          )

        expect(
          result
        ).toBeCloseTo(
          0.043902439,
          8
        )
      }
    )

    it(
      'vrací nulu při inflaci -100 %',
      () => {
        const result =
          calculateRealReturn(
            0.07,
            -1
          )

        expect(
          result
        ).toBe(0)
      }
    )
  }
)

describe(
  'annualToMonthlyRate',
  () => {
    it(
      'měsíční skládání odpovídá roční sazbě',
      () => {
        const monthlyRate =
          annualToMonthlyRate(
            0.12
          )

        const annualRate =
          Math.pow(
            1 + monthlyRate,
            12
          ) - 1

        expect(
          annualRate
        ).toBeCloseTo(
          0.12,
          10
        )
      }
    )

    it(
      'nulový roční výnos znamená nulový měsíční výnos',
      () => {
        expect(
          annualToMonthlyRate(
            0
          )
        ).toBe(0)
      }
    )
  }
)

describe(
  'calculateAccumulation',
  () => {
    it(
      'dosáhne cíle pouze pomocí vkladů při nulovém výnosu',
      () => {
        const result =
          calculateAccumulation({
            startCapital:
              1_000_000,

            monthlyContribution:
              50_000,

            targetCapital:
              1_600_000,

            nominalReturn:
              0,

            inflation:
              0,

            currentAgeMonths:
              35 * 12,

            calculationDate:
              new Date(
                '2026-01-15T12:00:00'
              ),
          })

        expect(
          result.targetReached
        ).toBe(true)

        expect(
          result.months
        ).toBe(12)

        expect(
          result.finalCapital
        ).toBeCloseTo(
          1_600_000,
          2
        )

        expect(
          result.totalContributions
        ).toBeCloseTo(
          1_600_000,
          2
        )

        expect(
          result.investmentGain
        ).toBe(0)
      }
    )

    it(
      'při již dosaženém cíli neprovádí další měsíc',
      () => {
        const result =
          calculateAccumulation({
            startCapital:
              2_000_000,

            monthlyContribution:
              50_000,

            targetCapital:
              1_500_000,

            nominalReturn:
              0.07,

            inflation:
              0.025,

            currentAgeMonths:
              35 * 12,

            calculationDate:
              new Date(
                '2026-01-15T12:00:00'
              ),
          })

        expect(
          result.months
        ).toBe(0)

        expect(
          result.targetReached
        ).toBe(true)

        expect(
          result.finalCapital
        ).toBe(
          2_000_000
        )

        expect(
          result.fireAgeMonths
        ).toBe(
          35 * 12
        )
      }
    )

    it(
      'při nulových vkladech a výnosu cíl nedosáhne',
      () => {
        const result =
          calculateAccumulation({
            startCapital:
              1_000_000,

            monthlyContribution:
              0,

            targetCapital:
              2_000_000,

            nominalReturn:
              0,

            inflation:
              0,

            currentAgeMonths:
              35 * 12,

            calculationDate:
              new Date(
                '2026-01-15T12:00:00'
              ),
          })

        expect(
          result.targetReached
        ).toBe(false)

        expect(
          result.months
        ).toBe(
          100 * 12
        )

        expect(
          result.finalCapital
        ).toBe(
          1_000_000
        )
      }
    )
  }
)

describe(
  'calculateRent',
  () => {
    it(
      'při nulovém výnosu odečítá pravidelnou rentu',
      () => {
        const result =
          calculateRent({
            startCapital:
              1_200_000,

            startAgeMonths:
              60 * 12,

            monthlyRent:
              10_000,

            nominalReturn:
              0,

            inflation:
              0,

            years:
              5,

            pensionAge:
              100,

            pensionAmount:
              0,

            indexation:
              false,

            dynamic:
              false,
          })

        expect(
          result.sustainable
        ).toBe(true)

        expect(
          result.endingCapital
        ).toBeCloseTo(
          600_000,
          2
        )

        expect(
          result.totalWithdrawn
        ).toBeCloseTo(
          600_000,
          2
        )
      }
    )

    it(
      'označí přesný měsíc vyčerpání kapitálu',
      () => {
        const result =
          calculateRent({
            startCapital:
              100_000,

            startAgeMonths:
              60 * 12,

            monthlyRent:
              20_000,

            nominalReturn:
              0,

            inflation:
              0,

            years:
              10,

            pensionAge:
              100,

            pensionAmount:
              0,

            indexation:
              false,

            dynamic:
              false,
          })

        expect(
          result.sustainable
        ).toBe(false)

        expect(
          result.depletionMonth
        ).toBe(5)

        expect(
          result.endingCapital
        ).toBe(0)

        expect(
          result.endingAgeMonths
        ).toBe(
          60 * 12 + 5
        )
      }
    )

    it(
      'státní důchod snižuje čerpání portfolia',
      () => {
        const result =
          calculateRent({
            startCapital:
              1_000_000,

            startAgeMonths:
              65 * 12,

            monthlyRent:
              30_000,

            nominalReturn:
              0,

            inflation:
              0,

            years:
              1,

            pensionAge:
              65,

            pensionAmount:
              20_000,

            indexation:
              false,

            dynamic:
              false,
          })

        expect(
          result.totalPension
        ).toBeCloseTo(
          240_000,
          2
        )

        expect(
          result.totalWithdrawn
        ).toBeCloseTo(
          120_000,
          2
        )

        expect(
          result.endingCapital
        ).toBeCloseTo(
          880_000,
          2
        )
      }
    )

    it(
      'počítá počáteční SWR',
      () => {
        const result =
          calculateRent({
            startCapital:
              30_000_000,

            startAgeMonths:
              50 * 12,

            monthlyRent:
              100_000,

            nominalReturn:
              0,

            inflation:
              0,

            years:
              1,

            pensionAge:
              100,

            pensionAmount:
              0,

            indexation:
              false,

            dynamic:
              false,
          })

        expect(
          result.initialSWR
        ).toBeCloseTo(
          4,
          10
        )
      }
    )
  }
)

describe(
  'formatAge',
  () => {
    it(
      'formátuje celé roky',
      () => {
        expect(
          formatAge(
            35 * 12
          )
        ).toBe(
          '35 let'
        )
      }
    )

    it(
      'formátuje roky a měsíce',
      () => {
        expect(
          formatAge(
            35 * 12 + 5
          )
        ).toBe(
          '35 let 5 měs.'
        )
      }
    )
  }
)