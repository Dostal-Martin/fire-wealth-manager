import { supabase } from '../lib/supabase'
import { validateInternalTransfer, type InternalTransferInput } from '../domain/internalTransfer'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type TransferAccount = {
  instrumentId: string
  name: string
  ticker: string | null
  currency: string
  quantity: number
  currentValueCzk: number
}

export async function getTransferAccounts(): Promise<TransferAccount[]> {
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
      instrumentId: row.instrument_id,
      name: instrument?.name ?? 'Hotovostní účet',
      ticker: instrument?.ticker ?? null,
      currency: (instrument?.currency ?? 'CZK').toUpperCase(),
      quantity: Number(row.quantity ?? 0),
      currentValueCzk: Number(row.current_value ?? 0),
    }
  })
}

export async function createInternalTransfer(input: InternalTransferInput) {
  const validation = validateInternalTransfer(input)
  if (!validation.valid) throw new Error(validation.errors.join(' '))

  const { data, error } = await supabase.rpc('record_internal_transfer', {
    p_portfolio_id: PORTFOLIO_ID,
    p_transfer_date: input.transferDate,
    p_source_instrument_id: input.sourceInstrumentId,
    p_destination_instrument_id: input.destinationInstrumentId,
    p_source_amount: input.sourceAmount,
    p_destination_amount: input.destinationAmount,
    p_source_value_czk: input.sourceValueCzk,
    p_destination_value_czk: input.destinationValueCzk,
    p_fee_czk: input.feeCzk,
    p_note: input.note.trim() || null,
  })

  if (error) throw error
  return data
}

export type InternalTransferRow = {
  id: string
  transfer_date: string
  source_amount: number | string
  destination_amount: number | string
  source_currency: string
  destination_currency: string
  source_value_czk: number | string
  destination_value_czk: number | string
  fee_czk: number | string
  note: string | null
  source_instrument: { name: string } | { name: string }[] | null
  destination_instrument: { name: string } | { name: string }[] | null
}

export async function getInternalTransfers(): Promise<InternalTransferRow[]> {
  const { data, error } = await supabase
    .from('account_transfers')
    .select(`
      id,
      transfer_date,
      source_amount,
      destination_amount,
      source_currency,
      destination_currency,
      source_value_czk,
      destination_value_czk,
      fee_czk,
      note,
      source_instrument:instruments!account_transfers_source_instrument_id_fkey(name),
      destination_instrument:instruments!account_transfers_destination_instrument_id_fkey(name)
    `)
    .eq('portfolio_id', PORTFOLIO_ID)
    .order('transfer_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as InternalTransferRow[]
}
