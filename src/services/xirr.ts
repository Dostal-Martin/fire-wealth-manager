import { supabase } from '../lib/supabase'

type Cashflow = {
  date: string
  amount: number
}

function xnpv(
  rate: number,
  cashflows: Cashflow[]
) {
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

  for (let i = 0; i < 100; i++) {
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

export async function getXirr() {
  const { data: cashflows } =
    await supabase
      .from('cashflows')
      .select(
        'transaction_date,amount_czk'
      )

  const { data: positions } =
    await supabase
      .from('positions')
      .select('current_value')

  const flows: Cashflow[] =
    (cashflows ?? []).map(
      (item) => ({
        date:
          item.transaction_date,
        amount:
          Number(item.amount_czk),
      })
    )

  const portfolioValue =
    (positions ?? []).reduce(
      (sum, p) =>
        sum +
        Number(p.current_value),
      0
    )

  flows.push({
    date: new Date()
      .toISOString()
      .substring(0, 10),

    amount: portfolioValue,
  })

  const result =
    calculateXirr(flows)

  return result * 100
}