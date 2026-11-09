import fireData from '../data/fireData.json'

type Cashflow = {
  date: string
  amount: number
}

function xnpv(rate: number, cashflows: Cashflow[]) {
  const firstDate = new Date(
    cashflows[0].date
  )

  return cashflows.reduce(
    (total, cashflow) => {
      const currentDate = new Date(
        cashflow.date
      )

      const days =
        (currentDate.getTime() -
          firstDate.getTime()) /
        (1000 * 60 * 60 * 24)

      return (
        total +
        cashflow.amount /
          Math.pow(
            1 + rate,
            days / 365
          )
      )
    },
    0
  )
}

function calculateXirr(
  cashflows: Cashflow[]
) {
  let rate = 0.1

  for (
    let i = 0;
    i < 100;
    i++
  ) {
    const npv = xnpv(rate, cashflows)

    const npv2 = xnpv(
      rate + 0.0001,
      cashflows
    )

    const derivative =
      (npv2 - npv) / 0.0001

    const newRate =
      rate - npv / derivative

    if (
      Math.abs(newRate - rate) <
      0.000001
    ) {
      return newRate
    }

    rate = newRate
  }

  return rate
}

export function getXirr() {
  const cashflows: Cashflow[] =
    fireData.cashflow.map(
      (item) => ({
        date: item.date,
        amount: item.amount,
      })
    )

  cashflows.push({
    date:
      fireData.history[
        fireData.history.length - 1
      ].date,

    amount:
      fireData.history[
        fireData.history.length - 1
      ].amount,
  })

  const result =
    calculateXirr(cashflows)

  return result * 100
}