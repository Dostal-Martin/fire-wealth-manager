import { supabase } from '../lib/supabase'
import { validateInvestmentIncome, type InvestmentIncomeInput } from '../domain/investmentIncome'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type IncomeInstrument = {
  id: string
  name: string
  ticker: string | null
  currency: string
}

export type IncomeCashAccount = {
  id: string
  name: string
  ticker: string | null
  currency: string
}

export async function getIncomeInstruments(): Promise<IncomeInstrument[]> {
  const { data, error } = await supabase
    .from('instruments')
    .select('id,name,ticker,currency,asset_type')
    .neq('asset_type', 'Hotovost')
    .order('name')

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    ticker: row.ticker ?? null,
    currency: (row.currency ?? 'CZK').toUpperCase(),
  }))
}

export async function getIncomeCashAccounts(): Promise<IncomeCashAccount[]> {
  const { data, error } = await supabase
    .from('positions')
    .select(`
      instrument_id,
      instruments!inner(name,ticker,currency,asset_type)
    `)
    .eq('portfolio_id', PORTFOLIO_ID)
    .eq('instruments.asset_type', 'Hotovost')

  if (error) throw error
  return (data ?? []).map((row) => {
    const instrument = Array.isArray(row.instruments) ? row.instruments[0] : row.instruments
    return {
      id: row.instrument_id,
      name: instrument?.name ?? 'Hotovostní účet',
      ticker: instrument?.ticker ?? null,
      currency: (instrument?.currency ?? 'CZK').toUpperCase(),
    }
  })
}

export async function createInvestmentIncome(input: InvestmentIncomeInput) {
  const validation = validateInvestmentIncome(input)
  if (!validation.valid) throw new Error(validation.errors.join(' '))

  const { data, error } = await supabase.rpc('record_investment_income', {
    p_portfolio_id: PORTFOLIO_ID,
    p_instrument_id: input.instrumentId,
    p_cash_instrument_id: input.cashInstrumentId,
    p_transaction_date: input.transactionDate,
    p_transaction_type: input.transactionType,
    p_amount_native: input.amountNative,
    p_currency: input.currency,
    p_fx_rate: input.fxRate,
    p_tax_native: input.taxNative,
    p_fee_native: input.feeNative,
    p_note: input.note.trim() || null,
  })

  if (error) throw error
  return data
}
