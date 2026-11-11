import { supabase } from '../lib/supabase'
import {
  calculatePerformanceReturns,
  type ExternalCashflow,
  type PerformanceReturns,
  type PortfolioValuation,
} from '../domain/performanceReturns'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

type CashflowRow = {
  transaction_date: string
  amount_czk: number | string
}

type SnapshotRow = {
  snapshot_date: string
  net_worth: number | string
}

function finiteNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export async function getPerformanceReturns(): Promise<PerformanceReturns> {
  const [cashflowResult, snapshotResult] = await Promise.all([
    supabase
      .from('cashflows')
      .select('transaction_date,amount_czk')
      .eq('portfolio_id', PORTFOLIO_ID)
      .eq('is_external', true)
      .in('transaction_type', ['DEPOSIT', 'CONTRIBUTION', 'WITHDRAWAL'])
      .order('transaction_date', { ascending: true }),

    supabase
      .from('portfolio_snapshots')
      .select('snapshot_date,net_worth')
      .eq('portfolio_id', PORTFOLIO_ID)
      .order('snapshot_date', { ascending: true }),
  ])

  if (cashflowResult.error) throw cashflowResult.error
  if (snapshotResult.error) throw snapshotResult.error

  const externalCashflows: ExternalCashflow[] = (
    (cashflowResult.data ?? []) as CashflowRow[]
  ).map((row) => ({
    date: row.transaction_date,
    amountCzk: finiteNumber(row.amount_czk),
  }))

  const valuations: PortfolioValuation[] = (
    (snapshotResult.data ?? []) as SnapshotRow[]
  ).map((row) => ({
    date: row.snapshot_date,
    valueCzk: finiteNumber(row.net_worth),
  }))

  return calculatePerformanceReturns(externalCashflows, valuations)
}
