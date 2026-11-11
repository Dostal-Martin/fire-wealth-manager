import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  calculateXirr,
  isValidXirrInput,
  xnpv,
} from './xirrCalculations'

describe(
  'isValidXirrInput',
  () => {
    it(
      'vyžaduje záporný i kladný tok',
      () => {
        expect(
          isValidXirrInput([
            {
              date:
                '2025-01-01',
              amount:
                -100000,
            },
            {
              date:
                '2026-01-01',
              amount:
                110000,
            },
          ])
        ).toBe(true)
      }
    )

    it(
      'odmítne pouze kladné toky',
      () => {
        expect(
          isValidXirrInput([
            {
              date:
                '2025-01-01',
              amount:
                100000,
            },
            {
              date:
                '2026-01-01',
              amount:
                110000,
            },
          ])
        ).toBe(false)
      }
    )

    it(
      'odmítne pouze záporné toky',
      () => {
        expect(
          isValidXirrInput([
            {
              date:
                '2025-01-01',
              amount:
                -100000,
            },
            {
              date:
                '2026-01-01',
              amount:
                -50000,
            },
          ])
        ).toBe(false)
      }
    )

    it(
      'vyžaduje minimálně dva toky',
      () => {
        expect(
          isValidXirrInput([
            {
              date:
                '2025-01-01',
              amount:
                -100000,
            },
          ])
        ).toBe(false)
      }
    )
  }
)

describe(
  'xnpv',
  () => {
    it(
      'má NPV přibližně nula při 10% roční návratnosti',
      () => {
        const result =
          xnpv(
            0.1,
            [
              {
                date:
                  '2025-01-01',
                amount:
                  -100000,
              },
              {
                date:
                  '2026-01-01',
                amount:
                  110000,
              },
            ]
          )

        expect(
          result
        ).toBeCloseTo(
          0,
          2
        )
      }
    )
  }
)

describe(
  'calculateXirr',
  () => {
    it(
      'spočítá přibližně 10 % za jeden rok',
      () => {
        const result =
          calculateXirr([
            {
              date:
                '2025-01-01',
              amount:
                -100000,
            },
            {
              date:
                '2026-01-01',
              amount:
                110000,
            },
          ])

        expect(
          result
        ).not.toBeNull()

        expect(
          result
        ).toBeCloseTo(
          0.1,
          4
        )
      }
    )

    it(
      'spočítá nulový výnos',
      () => {
        const result =
          calculateXirr([
            {
              date:
                '2025-01-01',
              amount:
                -100000,
            },
            {
              date:
                '2026-01-01',
              amount:
                100000,
            },
          ])

        expect(
          result
        ).not.toBeNull()

        expect(
          result
        ).toBeCloseTo(
          0,
          6
        )
      }
    )

    it(
      'podporuje několik postupných vkladů',
      () => {
        const result =
          calculateXirr([
            {
              date:
                '2025-01-01',
              amount:
                -100000,
            },
            {
              date:
                '2025-07-01',
              amount:
                -50000,
            },
            {
              date:
                '2026-01-01',
              amount:
                165000,
            },
          ])

        expect(
          result
        ).not.toBeNull()

        expect(
          Number.isFinite(
            result
          )
        ).toBe(true)
      }
    )

    it(
      'podporuje externí výběr',
      () => {
        const result =
          calculateXirr([
            {
              date:
                '2025-01-01',
              amount:
                -100000,
            },
            {
              date:
                '2025-07-01',
              amount:
                20000,
            },
            {
              date:
                '2026-01-01',
              amount:
                90000,
            },
          ])

        expect(
          result
        ).not.toBeNull()

        expect(
          Number.isFinite(
            result
          )
        ).toBe(true)
      }
    )

    it(
      'vrací null bez kladného toku',
      () => {
        expect(
          calculateXirr([
            {
              date:
                '2025-01-01',
              amount:
                -100000,
            },
            {
              date:
                '2026-01-01',
              amount:
                -50000,
            },
          ])
        ).toBeNull()
      }
    )
  }
)