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

export type SettlementAccount = {
  id: string
  name: string
  ticker: string | null
  currency: string
  quantity: number
  currentValueCzk: number
}

export type RecordedTransactionResult = {
  transactionId: string
  transactionType: 'BUY' | 'SELL'
  cashInstrumentId: string
  grossNative: number
  netNative: number
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
    .select('id,name,ticker,currency,asset_type')
    .neq('asset_type', 'Hotovost')
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    ticker: row.ticker ?? null,
    currency: (row.currency ?? 'CZK').toUpperCase(),
  }))
}

export async function getSettlementAccounts(): Promise<SettlementAccount[]> {
  const { data, error } = await supabase
    .from('positions')
    .select(`
      instrument_id,
      quantity,
      current_value,
      instruments!inner(name,ticker,currency,asset_type)
    `)
    .eq('portfolio_id', PORTFOLIO_ID)
    .eq('instruments.asset_type', 'Hotovost')
    .order('current_value', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => {
    const instrument = Array.isArray(row.instruments) ? row.instruments[0] : row.instruments
    return {
      id: row.instrument_id,
      name: instrument?.name ?? 'Hotovostní účet',
      ticker: instrument?.ticker ?? null,
      currency: (instrument?.currency ?? 'CZK').toUpperCase(),
      quantity: Number(row.quantity ?? 0),
      currentValueCzk: Number(row.current_value ?? 0),
    }
  })
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

  if (!validation.valid) throw new Error(validation.errors.join(' '))

  const { data, error } = await supabase.rpc(
    'record_portfolio_transaction_v2',
    {
      p_portfolio_id: PORTFOLIO_ID,
      p_instrument_id: input.instrumentId,
      p_cash_instrument_id: input.cashInstrumentId,
      p_transaction_date: input.transactionDate,
      p_transaction_type: input.transactionType,
      p_quantity: input.quantity,
      p_unit_price_native: input.unitPrice,
      p_currency: input.currency.toUpperCase(),
      p_fx_rate: input.fxRate,
      p_fee_native: input.feesNative,
      p_tax_native: input.taxNative,
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
    cashInstrumentId: String(result.cashInstrumentId),
    grossNative: Number(result.grossNative),
    netNative: Number(result.netNative),
    amountCzk: Number(result.amountCzk),
    quantity: Number(result.quantity),
    totalCost: Number(result.totalCost),
    currentValue: Number(result.currentValue),
    snapshotDate: String(result.snapshotDate),
    netWorth: Number(result.netWorth),
  }
}
