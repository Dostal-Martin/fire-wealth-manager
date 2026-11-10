import { supabase } from '../lib/supabase'

const PORTFOLIO_ID =
  '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type ExternalCashflowType =
  | 'CONTRIBUTION'
  | 'WITHDRAWAL'

export async function getCashflows() {
  const { data, error } = await supabase
    .from('cashflows')
    .select(`
      *,
      instruments (
        name
      )
    `)
    .order('transaction_date', {
      ascending: false,
    })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function createExternalCashflow(
  date: string,
  type: ExternalCashflowType,
  amount: number,
  note: string
) {
  const normalizedAmount =
    type === 'WITHDRAWAL'
      ? -Math.abs(amount)
      : Math.abs(amount)

  const { error } = await supabase
    .from('cashflows')
    .insert({
      portfolio_id: PORTFOLIO_ID,
      instrument_id: null,
      transaction_date: date,
      transaction_type: type,

      shares: null,
      price_per_unit: null,

      currency: 'CZK',
      fx_rate: 1,

      amount_czk:
        normalizedAmount,

      is_external: true,

      note:
        note.trim() === ''
          ? null
          : note.trim(),
    })

  if (error) {
    throw error
  }
}

export async function deleteCashflow(
  id: string
) {
  const { error } = await supabase
    .from('cashflows')
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}