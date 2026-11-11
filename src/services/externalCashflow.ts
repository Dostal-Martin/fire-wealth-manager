import { supabase } from '../lib/supabase'
import {
  validateExternalCashflow,
  type ExternalCashflowInput,
} from '../domain/externalCashflow'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type RecordedExternalCashflow = {
  cashflowId: string
  transactionType: 'DEPOSIT' | 'WITHDRAWAL'
  cashBalance: number
  netWorth: number
  snapshotDate: string
}

export async function createExternalCashflow(
  input: ExternalCashflowInput,
): Promise<RecordedExternalCashflow> {
  const validation = validateExternalCashflow(input)
  if (!validation.valid) throw new Error(validation.errors.join(' '))

  const { data, error } = await supabase.rpc('record_external_cashflow', {
    p_portfolio_id: PORTFOLIO_ID,
    p_transaction_date: input.transactionDate,
    p_transaction_type: input.transactionType,
    p_amount_czk: Math.abs(input.amountCzk),
    p_note: input.note.trim() || null,
  })

  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Databáze vrátila neplatný výsledek cashflow.')
  }

  const result = data as unknown as Record<string, unknown>
  return {
    cashflowId: String(result.cashflowId),
    transactionType: result.transactionType === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'DEPOSIT',
    cashBalance: Number(result.cashBalance),
    netWorth: Number(result.netWorth),
    snapshotDate: String(result.snapshotDate),
  }
}
