import { supabase } from '../lib/supabase'
import {
  validateExternalCashflow,
  type ExternalCashflowInput,
} from '../domain/externalCashflow'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export async function createExternalCashflow(
  input: ExternalCashflowInput,
) {
  const validation = validateExternalCashflow(input)

  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const { data, error } = await supabase
    .from('cashflows')
    .insert({
      portfolio_id: PORTFOLIO_ID,
      instrument_id: null,
      transaction_date: input.transactionDate,
      transaction_type: input.transactionType,
      shares: null,
      price_per_unit: null,
      currency: 'CZK',
      fx_rate: 1,
      amount_czk: validation.storedAmountCzk,
      note: input.note.trim() || null,
      is_external: true,
    })
    .select('id,transaction_date,transaction_type,amount_czk')
    .single()

  if (error) throw error
  return data
}
