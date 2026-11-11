import { supabase } from '../lib/supabase'
import { createExternalCashflow as createAtomicExternalCashflow } from './externalCashflow'

export type ExternalCashflowType = 'CONTRIBUTION' | 'DEPOSIT' | 'WITHDRAWAL'

export async function getCashflows() {
  const { data, error } = await supabase
    .from('cashflows')
    .select(`*, instruments (name)`)
    .order('transaction_date', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createExternalCashflow(
  date: string,
  type: ExternalCashflowType,
  amount: number,
  note: string,
) {
  return createAtomicExternalCashflow({
    transactionDate: date,
    transactionType: type === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'DEPOSIT',
    amountCzk: Math.abs(amount),
    note,
  })
}

export async function deleteCashflow(id: string) {
  // Mazání externího toku by muselo atomicky vrátit i hotovost a snapshot.
  // Po zavedení hotovostního účtu proto přímé mazání zakazujeme.
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
