import { supabase } from '../lib/supabase'
import fireData from '../data/fireData.json'

const PORTFOLIO_ID =
  '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

function mapTransactionType(type: string) {
  switch (type) {
    case 'Nákup':
      return 'BUY'

    case 'Prodej':
      return 'SELL'

    case 'Dividenda':
      return 'DIVIDEND'

    case 'Kupón':
      return 'COUPON'

    default:
      return 'OTHER'
  }
}

export async function importCashflow() {
  const { data: instruments, error } =
    await supabase
      .from('instruments')
      .select('id,name')

  if (error) {
    throw error
  }

  const instrumentMap =
    new Map(
      instruments.map((i) => [
        i.name,
        i.id,
      ])
    )

  const rows = fireData.cashflow.map(
    (item) => ({
      portfolio_id: PORTFOLIO_ID,

      instrument_id:
        instrumentMap.get(
          item.name
        ) ?? null,

      transaction_date:
        item.date,

      transaction_type:
        mapTransactionType(
          item.type
        ),

      shares:
        item.shares ?? null,

      price_per_unit:
        item.priceCzk ?? null,

      currency:
        item.currency ?? 'CZK',

      fx_rate:
        item.priceCurrency &&
        item.priceCzk
          ? item.priceCzk /
            item.priceCurrency
          : 1,

      amount_czk:
        item.amount,

      note: item.name,
    })
  )

  const { error: insertError } =
    await supabase
      .from('cashflows')
      .insert(rows)

  if (insertError) {
    throw insertError
  }

  return rows.length
}