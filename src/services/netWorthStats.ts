import fireData from '../data/fireData.json'

export function getNetWorthStats() {
  const history = fireData.history

  const current =
    history[history.length - 1].amount

  const ath = Math.max(
    ...history.map((x) => x.amount)
  )

  const drawdown =
    ((current - ath) / ath) * 100

  const start =
    history[0].amount

  const startDate = new Date(
    history[0].date
  )

  const endDate = new Date(
    history[history.length - 1].date
  )

  const totalYears =
    (endDate.getTime() -
      startDate.getTime()) /
    (365.25 *
      24 *
      60 *
      60 *
      1000)

  const cagrSinceStart =
    (
      Math.pow(
        current / start,
        1 / totalYears
      ) - 1
    ) * 100

  return {
    current,
    ath,
    drawdown,
    cagrSinceStart,
  }
}