import fireData from '../data/fireData.json'

export function getFireMetrics() {
  const currentNetWorth =
    fireData.history[
      fireData.history.length - 1
    ].amount

  const fireTarget = Number(
    fireData.settings.fireTarget
  )

  const monthlySavings = Number(
    fireData.settings.fireSavings
  )

  const expectedReturn =
    Number(
      fireData.settings.fireReturn
    ) / 100

  const progress =
    (currentNetWorth / fireTarget) * 100

  let capital = currentNetWorth
  let months = 0

  while (
    capital < fireTarget &&
    months < 600
  ) {
    capital =
      capital *
        (1 + expectedReturn / 12) +
      monthlySavings

    months++
  }

  const estimatedDate = new Date()
  estimatedDate.setMonth(
    estimatedDate.getMonth() + months
  )

  return {
    progress,
    estimatedDate,
  }
}