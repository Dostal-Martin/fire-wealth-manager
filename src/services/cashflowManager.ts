import { supabase } from '../lib/supabase'

export type ExternalCashflowType = 'CONTRIBUTION' | 'DEPOSIT' | 'WITHDRAWAL'

const CASHFLOW_TYPES = [
  'CONTRIBUTION',
  'DEPOSIT',
  'WITHDRAWAL',
  'DIVIDEND',
  'COUPON',
  'INTEREST',
]

export async function getCashflows() {
  const { data, error } = await supabase
    .from('cashflows')
    .select(`*, instruments (name)`)
    .in('transaction_type', CASHFLOW_TYPES)
    .order('transaction_date', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Legacy compatibility helper.
 * New external deposits/withdrawals are created through externalCashflow.ts,
 * where the user selects the actual cash account, currency and FX rate.
 */
export async function createExternalCashflow(
  _date: string,
  _type: ExternalCashflowType,
  _amount: number,
  _note: string,
): Promise<never> {
  throw new Error(
    'Starý způsob zápisu externího cashflow už není podporován. Použij formulář Externí kapitál se zvoleným hotovostním účtem.',
  )
}

export async function deleteCashflow(id: string) {
  const { data, error } = await supabase
    .from('cashflows')
    .select('is_external')
    .eq('id', id)
    .single()

  if (error) throw error
  if (data?.is_external) {
    throw new Error('Externí vklad/výběr nelze přímo smazat. Použij opačný opravný pohyb.')
  }

  const { error: deleteError } = await supabase
    .from('cashflows')
    .delete()
    .eq('id', id)

  if (deleteError) throw deleteError
}
