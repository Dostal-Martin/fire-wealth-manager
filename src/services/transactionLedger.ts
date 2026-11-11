import { supabase } from '../lib/supabase'
import {
  aggregateInvestmentIncome,
  calculateInvestmentPerformance,
  calculateLedgerByInstrument,
  reconcileLedgerWithPositions,
  type InstrumentIncomeSummary,
  type InstrumentLedgerResult,
  type InvestmentIncome,
  type InvestmentIncomeType,
  type LedgerPosition,
  type LedgerTransaction,
  type LedgerTransactionType,
  type ReconciliationStatus,
} from '../domain/transactionLedger'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

type TransactionRow = {
  id: string; portfolio_id: string; instrument_id: string; transaction_date: string; transaction_type: string
  quantity: number | string; unit_price: number | string; currency: string; fx_rate: number | string
  fees_czk: number | string; tax_czk: number | string; amount_czk: number | string; created_at: string | null
  instruments: { name: string; ticker: string | null } | Array<{ name: string; ticker: string | null }> | null
}
type PositionRow = { instrument_id: string | null; quantity: number | string | null; current_value: number | string | null }
type IncomeRow = { id: string; instrument_id: string | null; transaction_date: string; transaction_type: string; amount_czk: number | string }
type PositionAggregation = { quantity: number; currentValue: number }

export type TransactionLedgerInstrument = InstrumentLedgerResult & {
  instrumentName: string; ticker: string | null; positionQuantity: number | null; quantityDifference: number
  reconciliationStatus: ReconciliationStatus; currentValueCzk: number; unrealizedProfitLossCzk: number
  unrealizedReturnPercent: number | null; dividendIncomeCzk: number; couponIncomeCzk: number
  interestIncomeCzk: number; investmentIncomeCzk: number; totalProfitLossCzk: number
  totalReturnPercent: number | null
}

export type TransactionLedgerOverview = {
  instruments: TransactionLedgerInstrument[]; transactionCount: number; instrumentCount: number
  matchedCount: number; mismatchCount: number; noPositionCount: number; noLedgerCount: number
  invalidTransactionCount: number; realizedProfitLossCzk: number; unrealizedProfitLossCzk: number
  dividendIncomeCzk: number; couponIncomeCzk: number; interestIncomeCzk: number
  investmentIncomeCzk: number; totalProfitLossCzk: number; remainingCostBasisCzk: number
  currentValueCzk: number
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}
function resolveInstrument(value: TransactionRow['instruments']) { return Array.isArray(value) ? (value[0] ?? null) : value }
function normalizeType(value: string): LedgerTransactionType { return value.toUpperCase() === 'SELL' ? 'SELL' : 'BUY' }
function normalizeIncomeType(value: string): InvestmentIncomeType {
  const type = value.toUpperCase()
  if (type === 'COUPON') return 'COUPON'
  if (type === 'INTEREST') return 'INTEREST'
  return 'DIVIDEND'
}

function mapTransaction(row: TransactionRow): LedgerTransaction {
  return {
    id: row.id, portfolioId: row.portfolio_id, instrumentId: row.instrument_id,
    transactionDate: row.transaction_date, transactionType: normalizeType(row.transaction_type),
    quantity: toNumber(row.quantity), unitPrice: toNumber(row.unit_price), currency: row.currency,
    fxRate: toNumber(row.fx_rate), feesCzk: toNumber(row.fees_czk), taxCzk: toNumber(row.tax_czk),
    amountCzk: toNumber(row.amount_czk), createdAt: row.created_at,
  }
}

function aggregatePositions(rows: PositionRow[]) {
  const result = new Map<string, PositionAggregation>()
  for (const row of rows) {
    if (!row.instrument_id) continue
    const current = result.get(row.instrument_id) ?? { quantity: 0, currentValue: 0 }
    current.quantity += toNumber(row.quantity)
    current.currentValue += toNumber(row.current_value)
    result.set(row.instrument_id, current)
  }
  return result
}

export async function getTransactionLedgerOverview(): Promise<TransactionLedgerOverview> {
  const [transactionsResult, positionsResult, incomesResult] = await Promise.all([
    supabase.from('transactions').select(`id, portfolio_id, instrument_id, transaction_date, transaction_type, quantity, unit_price, currency, fx_rate, fees_czk, tax_czk, amount_czk, created_at, instruments (name, ticker)`).eq('portfolio_id', PORTFOLIO_ID).order('transaction_date', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('positions').select('instrument_id, quantity, current_value').eq('portfolio_id', PORTFOLIO_ID),
    supabase.from('cashflows').select('id, instrument_id, transaction_date, transaction_type, amount_czk').eq('portfolio_id', PORTFOLIO_ID).in('transaction_type', ['DIVIDEND', 'COUPON', 'INTEREST']).not('instrument_id', 'is', null).order('transaction_date', { ascending: true }),
  ])
  if (transactionsResult.error) throw transactionsResult.error
  if (positionsResult.error) throw positionsResult.error
  if (incomesResult.error) throw incomesResult.error

  const transactionRows = (transactionsResult.data ?? []) as unknown as TransactionRow[]
  const positionRows = (positionsResult.data ?? []) as unknown as PositionRow[]
  const incomeRows = (incomesResult.data ?? []) as unknown as IncomeRow[]
  const transactions = transactionRows.map(mapTransaction)
  const incomes: InvestmentIncome[] = incomeRows
    .filter((row): row is IncomeRow & { instrument_id: string } => Boolean(row.instrument_id))
    .map((row) => ({ id: row.id, instrumentId: row.instrument_id, transactionDate: row.transaction_date, incomeType: normalizeIncomeType(row.transaction_type), amountCzk: toNumber(row.amount_czk) }))

  const incomeByInstrument = aggregateInvestmentIncome(incomes)
  const ledgerResults = calculateLedgerByInstrument(transactions)
  const positionAggregation = aggregatePositions(positionRows)
  const positions: LedgerPosition[] = Array.from(positionAggregation.entries()).map(([instrumentId, position]) => ({ instrumentId, quantity: position.quantity }))
  const reconciliations = reconcileLedgerWithPositions(ledgerResults, positions)
  const reconciliationByInstrument = new Map(reconciliations.map((row) => [row.instrumentId, row]))
  const instrumentNameById = new Map<string, { name: string; ticker: string | null }>()
  for (const row of transactionRows) {
    const instrument = resolveInstrument(row.instruments)
    if (instrument) instrumentNameById.set(row.instrument_id, instrument)
  }

  const emptyIncome = (instrumentId: string): InstrumentIncomeSummary => ({
    instrumentId, dividendIncomeCzk: 0, couponIncomeCzk: 0, interestIncomeCzk: 0,
    investmentIncomeCzk: 0, incomeCount: 0,
  })

  const instruments: TransactionLedgerInstrument[] = ledgerResults.map((ledger) => {
    const identity = instrumentNameById.get(ledger.instrumentId)
    const reconciliation = reconciliationByInstrument.get(ledger.instrumentId)
    const performance = calculateInvestmentPerformance(
      ledger,
      positionAggregation.get(ledger.instrumentId)?.currentValue ?? 0,
      incomeByInstrument.get(ledger.instrumentId) ?? emptyIncome(ledger.instrumentId),
    )
    return {
      ...ledger, instrumentName: identity?.name ?? ledger.instrumentId, ticker: identity?.ticker ?? null,
      positionQuantity: reconciliation?.positionQuantity ?? null,
      quantityDifference: reconciliation?.difference ?? -ledger.ledgerQuantity,
      reconciliationStatus: reconciliation?.status ?? 'NO_POSITION', ...performance,
    }
  })

  const order: Record<ReconciliationStatus, number> = { MISMATCH: 0, NO_POSITION: 1, NO_LEDGER: 2, MATCH: 3 }
  instruments.sort((a, b) => order[a.reconciliationStatus] - order[b.reconciliationStatus] || a.instrumentName.localeCompare(b.instrumentName, 'cs'))
  const sum = (fn: (instrument: TransactionLedgerInstrument) => number) => instruments.reduce((total, instrument) => total + fn(instrument), 0)

  return {
    instruments, transactionCount: transactions.length, instrumentCount: instruments.length,
    matchedCount: instruments.filter((item) => item.reconciliationStatus === 'MATCH').length,
    mismatchCount: instruments.filter((item) => item.reconciliationStatus === 'MISMATCH').length,
    noPositionCount: instruments.filter((item) => item.reconciliationStatus === 'NO_POSITION').length,
    noLedgerCount: reconciliations.filter((item) => item.status === 'NO_LEDGER').length,
    invalidTransactionCount: sum((item) => item.invalidTransactionCount),
    realizedProfitLossCzk: sum((item) => item.realizedProfitLossCzk),
    unrealizedProfitLossCzk: sum((item) => item.unrealizedProfitLossCzk),
    dividendIncomeCzk: sum((item) => item.dividendIncomeCzk),
    couponIncomeCzk: sum((item) => item.couponIncomeCzk),
    interestIncomeCzk: sum((item) => item.interestIncomeCzk),
    investmentIncomeCzk: sum((item) => item.investmentIncomeCzk),
    totalProfitLossCzk: sum((item) => item.totalProfitLossCzk),
    remainingCostBasisCzk: sum((item) => item.remainingCostBasisCzk),
    currentValueCzk: sum((item) => item.currentValueCzk),
  }
}
