import { supabase } from '../lib/supabase'
import {
  validateManualTransaction,
  type ManualTransactionInput,
} from '../domain/transactionEntry'
import { getTransactionLedgerOverview } from './transactionLedger'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type TradableInstrument = {
  id: string
  name: string
  ticker: string | null
  currency: string
}

export type RecordedTransactionResult = {
  transactionId: string
  transactionType: 'BUY' | 'SELL'
  amountCzk: number
  quantity: number
  totalCost: number
  currentValue: number
  snapshotDate: string
  netWorth: number
}

export async function getTradableInstruments(): Promise<TradableInstrument[]> {
  const { data, error } = await supabase
    .from('instruments')
    .select('id,name,ticker,currency')
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    ticker: row.ticker ?? null,
    currency: (row.currency ?? 'CZK').toUpperCase(),
  }))
}

export async function createManualTransaction(
  input: ManualTransactionInput,
): Promise<RecordedTransactionResult> {
  const overview = await getTransactionLedgerOverview()
  const ledgerInstrument = overview.instruments.find(
    (item) => item.instrumentId === input.instrumentId,
  )

  const availableQuantity = ledgerInstrument?.ledgerQuantity ?? 0
  const validation = validateManualTransaction(
    input,
    input.transactionType === 'SELL' ? availableQuantity : null,
  )

  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const { data, error } = await supabase.rpc(
    'record_portfolio_transaction',
    {
      p_portfolio_id: PORTFOLIO_ID,
      p_instrument_id: input.instrumentId,
      p_transaction_date: input.transactionDate,
      p_transaction_type: input.transactionType,
      p_quantity: input.quantity,
      p_unit_price: input.unitPrice,
      p_currency: input.currency.toUpperCase(),
      p_fx_rate: input.fxRate,
      p_fees_czk: input.feesCzk,
      p_tax_czk: input.taxCzk,
      p_note: input.note.trim() || null,
    },
  )

  if (error) throw error

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Databáze vrátila neplatný výsledek transakce.')
  }

  const result = data as unknown as Record<string, unknown>

  return {
    transactionId: String(result.transactionId),
    transactionType: result.transactionType === 'SELL' ? 'SELL' : 'BUY',
    amountCzk: Number(result.amountCzk),
    quantity: Number(result.quantity),
    totalCost: Number(result.totalCost),
    currentValue: Number(result.currentValue),
    snapshotDate: String(result.snapshotDate),
    netWorth: Number(result.netWorth),
  }
}
