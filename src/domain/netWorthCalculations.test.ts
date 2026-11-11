import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  calculateNetWorth,
} from './netWorthCalculations'

describe(
  'calculateNetWorth',
  () => {
    it(
      'sečte kladné pozice jako aktiva',
      () => {
        const result =
          calculateNetWorth([
            {
              current_value:
                1_000_000,
            },
            {
              current_value:
                500_000,
            },
          ])

        expect(
          result.assets
        ).toBe(
          1_500_000
        )

        expect(
          result.liabilities
        ).toBe(0)

        expect(
          result.netWorth
        ).toBe(
          1_500_000
        )
      }
    )

    it(
      'sečte záporné pozice jako pasiva',
      () => {
        const result =
          calculateNetWorth([
            {
              current_value:
                -500_000,
            },
            {
              current_value:
                -250_000,
            },
          ])

        expect(
          result.assets
        ).toBe(0)

        expect(
          result.liabilities
        ).toBe(
          -750_000
        )

        expect(
          result.netWorth
        ).toBe(
          -750_000
        )
      }
    )

    it(
      'spočítá aktiva minus pasiva',
      () => {
        const result =
          calculateNetWorth([
            {
              current_value:
                10_000_000,
            },
            {
              current_value:
                5_000_000,
            },
            {
              current_value:
                -3_000_000,
            },
          ])

        expect(
          result.assets
        ).toBe(
          15_000_000
        )

        expect(
          result.liabilities
        ).toBe(
          -3_000_000
        )

        expect(
          result.netWorth
        ).toBe(
          12_000_000
        )
      }
    )

    it(
      'považuje nulu za platnou pozici',
      () => {
        const result =
          calculateNetWorth([
            {
              current_value:
                0,
            },
          ])

        expect(
          result.netWorth
        ).toBe(0)

        expect(
          result.validPositionCount
        ).toBe(1)

        expect(
          result.invalidPositionCount
        ).toBe(0)
      }
    )

    it(
      'ignoruje null hodnotu',
      () => {
        const result =
          calculateNetWorth([
            {
              current_value:
                1_000_000,
            },
            {
              current_value:
                null,
            },
          ])

        expect(
          result.netWorth
        ).toBe(
          1_000_000
        )

        expect(
          result.positionCount
        ).toBe(2)

        expect(
          result.validPositionCount
        ).toBe(1)

        expect(
          result.invalidPositionCount
        ).toBe(1)
      }
    )

    it(
      'ignoruje neplatný číselný řetězec',
      () => {
        const result =
          calculateNetWorth([
            {
              current_value:
                'abc',
            },
            {
              current_value:
                500_000,
            },
          ])

        expect(
          result.netWorth
        ).toBe(
          500_000
        )

        expect(
          result.invalidPositionCount
        ).toBe(1)
      }
    )

    it(
      'podporuje numeric hodnoty ze Supabase jako string',
      () => {
        const result =
          calculateNetWorth([
            {
              current_value:
                '1250000.50',
            },
            {
              current_value:
                '-250000.25',
            },
          ])

        expect(
          result.assets
        ).toBeCloseTo(
          1_250_000.50,
          2
        )

        expect(
          result.liabilities
        ).toBeCloseTo(
          -250_000.25,
          2
        )

        expect(
          result.netWorth
        ).toBeCloseTo(
          1_000_000.25,
          2
        )
      }
    )

    it(
      'vrátí nuly pro prázdné portfolio',
      () => {
        const result =
          calculateNetWorth([])

        expect(
          result
        ).toEqual({
          assets: 0,
          liabilities: 0,
          netWorth: 0,
          positionCount: 0,
          validPositionCount: 0,
          invalidPositionCount: 0,
        })
      }
    )
  }
)