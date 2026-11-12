import { supabase } from '../lib/supabase'

export type ExternalCashflowType = 'CONTRIBUTION' | 'DEPOSIT' | 'WITHDRAWAL'

export async function getCashflows() {
  const { data, error } = await supabase
    .from('cashflows')
    .select(`*, instruments (name)`)
    .order('transaction_date', { ascending: false })

  if (error) throw error
  return data ?? []
}

/**
 * Legacy compatibility helper.
 * New external deposits/withdrawals are created exclusively through
 * src/services/externalCashflow.ts, where the user selects the cash account,
 * native currency amount and FX rate.
 */
export async function createExternalCashflow(
  _date: string,
  _type: ExternalCashflowType,
  _amount: number,
  _note: string,
): Promise<never> {
  throw new Error(
    'Tento starý způsob zápisu externího cashflow už není podporován. Použij formulář Externí kapitál se zvoleným hotovostním účtem.',
  )
}

export async function deleteCashflow(id: string) {
  // Mazání externího toku by muselo atomicky vrátit i hotovost a snapshot.
  // Proto přímé mazání externích pohybů zakazujeme a používáme opačný opravný pohyb.
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
