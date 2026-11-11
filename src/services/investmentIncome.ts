import { supabase } from '../lib/supabase'
import {
  validateInvestmentIncome,
  type InvestmentIncomeInput,
  type InvestmentIncomeEntryType,
} from '../domain/investmentIncome'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type IncomeInstrument = {
  id: string
  name: string
  ticker: string | null
  currency: string
}

export type RecordedInvestmentIncome = {
  cashflowId: string
  transactionType: InvestmentIncomeEntryType
  amountCzk: number
  cashBalance: number
  snapshotDate: string
  netWorth: number
}

export async function getIncomeInstruments(): Promise<IncomeInstrument[]> {
  const { data, error } = await supabase
    .from('instruments')
    .select('id,name,ticker,currency')
    .neq('ticker', 'CASH.CZK')
    .order('name')

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    ticker: row.ticker ?? null,
    currency: (row.currency ?? 'CZK').toUpperCase(),
  }))
}

export async function createInvestmentIncome(
  input: InvestmentIncomeInput,
): Promise<RecordedInvestmentIncome> {
  const validation = validateInvestmentIncome(input)
  if (!validation.valid) throw new Error(validation.errors.join(' '))

  const { data, error } = await supabase.rpc('record_investment_income', {
    p_portfolio_id: PORTFOLIO_ID,
    p_instrument_id: input.instrumentId,
    p_transaction_date: input.transactionDate,
    p_transaction_type: input.transactionType,
    p_amount_czk: input.amountCzk,
    p_currency: input.currency.toUpperCase(),
    p_fx_rate: input.fxRate,
    p_note: input.note.trim() || null,
  })

  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Databáze vrátila neplatný výsledek investičního příjmu.')
  }

  const result = data as unknown as Record<string, unknown>
  const transactionType: InvestmentIncomeEntryType =
    result.transactionType === 'COUPON'
      ? 'COUPON'
      : result.transactionType === 'INTEREST'
        ? 'INTEREST'
        : 'DIVIDEND'

  return {
    cashflowId: String(result.cashflowId),
    transactionType,
    amountCzk: Number(result.amountCzk),
    cashBalance: Number(result.cashBalance),
    snapshotDate: String(result.snapshotDate),
    netWorth: Number(result.netWorth),
  }
}
