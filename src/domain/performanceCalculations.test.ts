import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  calculateCagr,
  calculateModifiedDietzTwr,
  daysBetween,
} from './performanceCalculations'

describe(
  'daysBetween',
  () => {
    it(
      'spočítá rozdíl kalendářních dní',
      () => {
        expect(
          daysBetween(
            '2025-01-01',
            '2025-01-11'
          )
        ).toBe(10)
      }
    )
  }
)

describe(
  'calculateCagr',
  () => {
    it(
      'spočítá přibližně 10 % za jeden rok',
      () => {
        const result =
          calculateCagr(
            10_000_000,
            11_000_000,
            '2025-01-01',
            '2026-01-01'
          )

        expect(
          result
        ).not.toBeNull()

        expect(
          result
        ).toBeCloseTo(
          10,
          1
        )
      }
    )

    it(
      'spočítá víceleté CAGR',
      () => {
        const result =
          calculateCagr(
            10_000_000,
            12_100_000,
            '2024-01-01',
            '2026-01-01'
          )

        expect(
          result
        ).not.toBeNull()

        expect(
          result
        ).toBeCloseTo(
          10,
          1
        )
      }
    )

    it(
      'vrací null při nulové počáteční hodnotě',
      () => {
        expect(
          calculateCagr(
            0,
            1_000_000,
            '2025-01-01',
            '2026-01-01'
          )
        ).toBeNull()
      }
    )

    it(
      'vrací null pro stejné datum',
      () => {
        expect(
          calculateCagr(
            1_000_000,
            1_100_000,
            '2025-01-01',
            '2025-01-01'
          )
        ).toBeNull()
      }
    )

    it(
      'vrací null při záporné hodnotě',
      () => {
        expect(
          calculateCagr(
            -1_000_000,
            1_100_000,
            '2025-01-01',
            '2026-01-01'
          )
        ).toBeNull()
      }
    )
  }
)

describe(
  'calculateModifiedDietzTwr',
  () => {
    it(
      'bez externího cashflow vrací null',
      () => {
        const result =
          calculateModifiedDietzTwr(
            [
              {
                snapshot_date:
                  '2025-01-01',

                net_worth:
                  1_000_000,
              },
              {
                snapshot_date:
                  '2026-01-01',

                net_worth:
                  1_100_000,
              },
            ],
            []
          )

        expect(
          result.twr
        ).toBeNull()

        expect(
          result.startDate
        ).toBeNull()
      }
    )

    it(
      'bez snapshotu před prvním externím tokem vrací null',
      () => {
        const result =
          calculateModifiedDietzTwr(
            [
              {
                snapshot_date:
                  '2025-02-01',

                net_worth:
                  1_100_000,
              },
              {
                snapshot_date:
                  '2025-03-01',

                net_worth:
                  1_200_000,
              },
            ],
            [
              {
                transaction_date:
                  '2025-01-15',

                amount_czk:
                  100_000,
              },
            ]
          )

        expect(
          result.twr
        ).toBeNull()

        expect(
          result.startDate
        ).toBeNull()
      }
    )

    it(
      'spočítá nulový výnos pokud růst přesně odpovídá vkladu',
      () => {
        const result =
          calculateModifiedDietzTwr(
            [
              {
                snapshot_date:
                  '2025-01-01',

                net_worth:
                  1_000_000,
              },
              {
                snapshot_date:
                  '2025-02-01',

                net_worth:
                  1_100_000,
              },
            ],
            [
              {
                transaction_date:
                  '2025-01-15',

                amount_czk:
                  100_000,
              },
            ]
          )

        expect(
          result.twr
        ).not.toBeNull()

        expect(
          result.twr
        ).toBeCloseTo(
          0,
          8
        )
      }
    )

    it(
      'oddělí výnos od externího vkladu',
      () => {
        const result =
          calculateModifiedDietzTwr(
            [
              {
                snapshot_date:
                  '2025-01-01',

                net_worth:
                  1_000_000,
              },
              {
                snapshot_date:
                  '2025-02-01',

                net_worth:
                  1_150_000,
              },
            ],
            [
              {
                transaction_date:
                  '2025-01-15',

                amount_czk:
                  100_000,
              },
            ]
          )

        expect(
          result.twr
        ).not.toBeNull()

        expect(
          result.twr as number
        ).toBeGreaterThan(
          0
        )

        expect(
          result.twr as number
        ).toBeLessThan(
          10
        )
      }
    )

    it(
      'podporuje externí výběr',
      () => {
        const result =
          calculateModifiedDietzTwr(
            [
              {
                snapshot_date:
                  '2025-01-01',

                net_worth:
                  1_000_000,
              },
              {
                snapshot_date:
                  '2025-02-01',

                net_worth:
                  950_000,
              },
            ],
            [
              {
                transaction_date:
                  '2025-01-15',

                amount_czk:
                  -50_000,
              },
            ]
          )

        expect(
          result.twr
        ).not.toBeNull()

        expect(
          result.twr
        ).toBeCloseTo(
          0,
          8
        )
      }
    )

    it(
      'cashflow na koncovém dni období má nulovou váhu',
      () => {
        const result =
          calculateModifiedDietzTwr(
            [
              {
                snapshot_date:
                  '2025-01-01',

                net_worth:
                  1_000_000,
              },
              {
                snapshot_date:
                  '2025-02-01',

                net_worth:
                  1_100_000,
              },
            ],
            [
              {
                transaction_date:
                  '2025-02-01',

                amount_czk:
                  100_000,
              },
            ]
          )

        expect(
          result.twr
        ).not.toBeNull()

        expect(
          result.twr
        ).toBeCloseTo(
          0,
          8
        )
      }
    )

    it(
      'řetězí dvě po sobě jdoucí období',
      () => {
        /*
         * 1. období:
         *
         * start = 1 000 000
         * externí vklad na konci = 100
         * end = 1 100 100
         *
         * Výnos:
         *
         * (1 100 100 - 1 000 000 - 100)
         * / 1 000 000
         * = 10 %
         *
         * 2. období:
         *
         * start = 1 100 100
         * end = 1 210 110
         *
         * Výnos = 10 %
         *
         * Řetězený výnos:
         *
         * 1.10 × 1.10 - 1
         * = 21 %
         */

        const result =
          calculateModifiedDietzTwr(
            [
              {
                snapshot_date:
                  '2025-01-01',

                net_worth:
                  1_000_000,
              },
              {
                snapshot_date:
                  '2025-02-01',

                net_worth:
                  1_100_100,
              },
              {
                snapshot_date:
                  '2025-03-01',

                net_worth:
                  1_210_110,
              },
            ],
            [
              {
                transaction_date:
                  '2025-02-01',

                amount_czk:
                  100,
              },
            ]
          )

        expect(
          result.twr
        ).not.toBeNull()

        expect(
          result.twr
        ).toBeCloseTo(
          21,
          6
        )

        expect(
          result.startDate
        ).toBe(
          '2025-01-01'
        )

        expect(
          result.endDate
        ).toBe(
          '2025-03-01'
        )
      }
    )

    it(
      'přeskočí období s neplatným denominator',
      () => {
        const result =
          calculateModifiedDietzTwr(
            [
              {
                snapshot_date:
                  '2025-01-01',

                net_worth:
                  100,
              },
              {
                snapshot_date:
                  '2025-02-01',

                net_worth:
                  100,
              },
            ],
            [
              {
                transaction_date:
                  '2025-01-15',

                amount_czk:
                  -1_000,
              },
            ]
          )

        expect(
          result.twr
        ).toBeNull()
      }
    )
  }
)