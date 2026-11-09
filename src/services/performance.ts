import fireData from '../data/fireData.json'

export function getPerformanceMetrics() {
  const history = fireData.history

  const lastValue =
    history[history.length - 1].amount

  const start2026 =
    history.find(
      (item) =>
        item.date === '2026-01-01'
    )?.amount ?? 0

  const ytd =
    ((lastValue / start2026 - 1) *
      100)

  return {
    ytd,
  }
}
