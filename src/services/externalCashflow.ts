import { supabase } from '../lib/supabase'
import { validateExternalCashflow, type ExternalCashflowInput } from '../domain/externalCashflow'
const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'
export type ExternalCashAccount = { id:string; name:string; ticker:string|null; currency:string; quantity:number; currentValueCzk:number }
export async function getExternalCashAccounts(): Promise<ExternalCashAccount[]> {
  const { data,error } = await supabase.from('positions').select(`instrument_id,quantity,current_value,instruments!inner(name,ticker,currency,asset_type)`).eq('portfolio_id',PORTFOLIO_ID).eq('instruments.asset_type','Hotovost').order('current_value',{ascending:false})
  if(error) throw error
  return (data??[]).map((row)=>{ const i=Array.isArray(row.instruments)?row.instruments[0]:row.instruments; return {id:row.instrument_id,name:i?.name??'Hotovostní účet',ticker:i?.ticker??null,currency:(i?.currency??'CZK').toUpperCase(),quantity:Number(row.quantity??0),currentValueCzk:Number(row.current_value??0)} })
}
export async function createExternalCashflow(input:ExternalCashflowInput){
  const validation=validateExternalCashflow(input); if(!validation.valid) throw new Error(validation.errors.join(' '))
  const {data,error}=await supabase.rpc('record_external_cashflow_v2',{p_portfolio_id:PORTFOLIO_ID,p_cash_instrument_id:input.cashInstrumentId,p_transaction_date:input.transactionDate,p_transaction_type:input.transactionType,p_amount_native:input.amountNative,p_currency:input.currency,p_fx_rate:input.fxRate,p_note:input.note.trim()||null})
  if(error) throw error; return data
}
