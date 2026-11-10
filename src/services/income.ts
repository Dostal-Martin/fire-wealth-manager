import { supabase } from '../lib/supabase'

export async function getIncomeStats() {
  const { data, error } = await supabase
    .from('cashflows')
    .select(`
      *,
      instruments (
        name
      )
    `)

  if (error) {
    throw error
  }

  const dividends = (data ?? []).filter(
    (x) => x.transaction_type === 'DIVIDEND'
  )

  const coupons = (data ?? []).filter(
    (x) => x.transaction_type === 'COUPON'
  )

  const dividendTotal = dividends.reduce(
    (sum, x) => sum + Number(x.amount_czk),
    0
  )

  const couponTotal = coupons.reduce(
    (sum, x) => sum + Number(x.amount_czk),
    0
  )

  const yearlyMap: Record<
    string,
    {
      year: string
      dividends: number
      coupons: number
    }
  > = {}

  ;(data ?? []).forEach((item) => {
    const year =
      item.transaction_date.substring(0, 4)

    if (!yearlyMap[year]) {
      yearlyMap[year] = {
        year,
        dividends: 0,
        coupons: 0,
      }
    }

    if (
      item.transaction_type ===
      'DIVIDEND'
    ) {
      yearlyMap[year].dividends +=
        Number(item.amount_czk)
    }

    if (
      item.transaction_type ===
      'COUPON'
    ) {
      yearlyMap[year].coupons +=
        Number(item.amount_czk)
    }
  })

  const yearlyIncome = Object.values(
    yearlyMap
  )
    .map((row) => ({
      ...row,
      total:
        row.dividends + row.coupons,
    }))
    .sort(
      (a, b) =>
        Number(a.year) -
        Number(b.year)
    )

  return {
    dividendTotal,
    couponTotal,
    passiveIncome:
      dividendTotal + couponTotal,
    yearlyIncome,
  }
}