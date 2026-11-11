import { describe, expect, it } from 'vitest'
import {
  calculatePerformanceReturns,
  calculateTwr,
  calculateXirr,
} from './performanceReturns'

describe('calculateXirr', () => {
  it('spočítá přibližně 10 % za jeden rok', () => {
    const result = calculateXirr(
      [{ date: '2025-01-01', amountCzk: 100_000 }],
      110_000,
      '2026-01-01',
    )

    expect(result.available).toBe(true)
    expect(result.value).toBeCloseTo(0.1, 3)
    expect(result.startDate).toBe('2025-01-01')
  })

  it('vrátí důvod bez externích toků', () => {
    const result = calculateXirr([], 100_000, '2026-01-01')
    expect(result.available).toBe(false)
    expect(result.reason).toContain('externí vklad')
  })

  it('zahrne výběr jako kladný tok investora', () => {
    const result = calculateXirr(
      [
        { date: '2025-01-01', amountCzk: 100_000 },
        { date: '2025-07-01', amountCzk: -10_000 },
      ],
      100_000,
      '2026-01-01',
    )

    expect(result.available).toBe(true)
    expect(result.value).not.toBeNull()
    expect(result.value as number).toBeGreaterThan(0)
  })
})

describe('calculateTwr', () => {
  it('neutralizuje externí vklad v den snapshotu', () => {
    const result = calculateTwr(
      [
        { date: '2025-01-01', amountCzk: 100_000 },
        { date: '2025-02-01', amountCzk: 50_000 },
      ],
      [
        { date: '2025-01-01', valueCzk: 100_000 },
        { date: '2025-02-01', valueCzk: 160_000 },
        { date: '2025-03-01', valueCzk: 176_000 },
      ],
    )

    // 10 % v prvním období po očištění vkladu a 10 % ve druhém období.
    expect(result.available).toBe(true)
    expect(result.value).toBeCloseTo(0.21, 8)
  })

  it('není dostupné bez dvou snapshotů', () => {
    const result = calculateTwr(
      [{ date: '2025-01-01', amountCzk: 100_000 }],
      [{ date: '2025-01-01', valueCzk: 100_000 }],
    )

    expect(result.available).toBe(false)
    expect(result.reason).toContain('dvě ocenění')
  })
})

describe('calculatePerformanceReturns', () => {
  it('vrátí datum prvního externího toku a obě metriky', () => {
    const result = calculatePerformanceReturns(
      [{ date: '2025-01-01', amountCzk: 100_000 }],
      [
        { date: '2025-01-01', valueCzk: 100_000 },
        { date: '2026-01-01', valueCzk: 110_000 },
      ],
    )

    expect(result.firstExternalCashflowDate).toBe('2025-01-01')
    expect(result.xirr.available).toBe(true)
    expect(result.twr.available).toBe(true)
  })
})
