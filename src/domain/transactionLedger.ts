export type LedgerTransactionType = 'BUY' | 'SELL'
export type InvestmentIncomeType = 'DIVIDEND' | 'COUPON' | 'INTEREST'

export type LedgerTransaction = {
  id: string; portfolioId: string; instrumentId: string; transactionDate: string
  transactionType: LedgerTransactionType; quantity: number; unitPrice: number
  currency: string; fxRate: number; feesCzk: number; taxCzk: number; amountCzk: number
  createdAt?: string | null
}

export type InvestmentIncome = {
  id: string; instrumentId: string; transactionDate: string
  incomeType: InvestmentIncomeType; amountCzk: number
}

export type InstrumentIncomeSummary = {
  instrumentId: string; dividendIncomeCzk: number; couponIncomeCzk: number
  interestIncomeCzk: number; investmentIncomeCzk: number; incomeCount: number
}

export type LedgerIssueCode = 'INVALID_TRANSACTION' | 'OVERSOLD_POSITION'
export type LedgerIssue = {
  transactionId: string; instrumentId: string; transactionDate: string
  code: LedgerIssueCode; message: string
}

export type ProcessedLedgerTransaction = {
  id: string; transactionDate: string; transactionType: LedgerTransactionType
  quantity: number; amountCzk: number; quantityBefore: number; quantityAfter: number
  averageCostBefore: number; averageCostAfter: number; costBasisBefore: number
  costBasisAfter: number; disposedCostBasis: number; realizedProfitLoss: number | null
  valid: boolean
}

export type InstrumentLedgerResult = {
  portfolioId: string; instrumentId: string; buyQuantity: number; sellQuantity: number
  ledgerQuantity: number; totalBuyAmountCzk: number; totalSellAmountCzk: number
  remainingCostBasisCzk: number; averageCostCzk: number; realizedProfitLossCzk: number
  incomeFromSalesCzk: number; processedTransactionCount: number
  invalidTransactionCount: number; transactions: ProcessedLedgerTransaction[]
  issues: LedgerIssue[]
}

export type InstrumentInvestmentPerformance = {
  currentValueCzk: number; unrealizedProfitLossCzk: number
  unrealizedReturnPercent: number | null; realizedProfitLossCzk: number
  dividendIncomeCzk: number; couponIncomeCzk: number; interestIncomeCzk: number
  investmentIncomeCzk: number; totalProfitLossCzk: number
  totalReturnPercent: number | null
}

export type ReconciliationStatus = 'MATCH' | 'MISMATCH' | 'NO_POSITION' | 'NO_LEDGER'
export type LedgerReconciliation = {
  instrumentId: string; positionQuantity: number | null; ledgerQuantity: number
  difference: number; absoluteDifference: number; tolerance: number
  status: ReconciliationStatus
}
export type LedgerPosition = { instrumentId: string; quantity: number | null }

const DEFAULT_TOLERANCE = 0.01
const EPSILON = 0.000000001

function normalizeNumber(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.abs(value) < EPSILON ? 0 : value
}

function compareTransactions(a: LedgerTransaction, b: LedgerTransaction) {
  return a.transactionDate.localeCompare(b.transactionDate)
    || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    || a.id.localeCompare(b.id)
}

function isValidTransaction(t: LedgerTransaction) {
  return Boolean(t.id && t.portfolioId && t.instrumentId && t.transactionDate)
    && (t.transactionType === 'BUY' || t.transactionType === 'SELL')
    && Number.isFinite(t.quantity) && t.quantity > 0
    && Number.isFinite(t.unitPrice) && t.unitPrice >= 0
    && Number.isFinite(t.fxRate) && t.fxRate > 0
    && Number.isFinite(t.feesCzk) && t.feesCzk >= 0
    && Number.isFinite(t.taxCzk) && t.taxCzk >= 0
    && Number.isFinite(t.amountCzk) && t.amountCzk > 0
}

export function calculateInstrumentLedger(transactions: LedgerTransaction[]): InstrumentLedgerResult {
  const first = transactions[0]
  const sorted = [...transactions].sort(compareTransactions)
  let buyQuantity = 0, sellQuantity = 0, ledgerQuantity = 0
  let remainingCostBasisCzk = 0, totalBuyAmountCzk = 0, totalSellAmountCzk = 0
  let realizedProfitLossCzk = 0, processedTransactionCount = 0, invalidTransactionCount = 0
  const processed: ProcessedLedgerTransaction[] = []
  const issues: LedgerIssue[] = []

  for (const t of sorted) {
    const quantityBefore = ledgerQuantity
    const costBasisBefore = remainingCostBasisCzk
    const averageCostBefore = quantityBefore > 0 ? costBasisBefore / quantityBefore : 0

    if (!isValidTransaction(t)) {
      invalidTransactionCount += 1
      issues.push({ transactionId: t.id, instrumentId: t.instrumentId, transactionDate: t.transactionDate, code: 'INVALID_TRANSACTION', message: 'Transakce obsahuje neplatné množství, cenu, kurz nebo částku.' })
      processed.push({ id: t.id, transactionDate: t.transactionDate, transactionType: t.transactionType, quantity: t.quantity, amountCzk: t.amountCzk, quantityBefore, quantityAfter: quantityBefore, averageCostBefore, averageCostAfter: averageCostBefore, costBasisBefore, costBasisAfter: costBasisBefore, disposedCostBasis: 0, realizedProfitLoss: null, valid: false })
      continue
    }

    if (t.transactionType === 'BUY') {
      buyQuantity += t.quantity
      totalBuyAmountCzk += t.amountCzk
      ledgerQuantity = normalizeNumber(ledgerQuantity + t.quantity)
      remainingCostBasisCzk = normalizeNumber(remainingCostBasisCzk + t.amountCzk)
      const averageCostAfter = ledgerQuantity > 0 ? remainingCostBasisCzk / ledgerQuantity : 0
      processedTransactionCount += 1
      processed.push({ id: t.id, transactionDate: t.transactionDate, transactionType: t.transactionType, quantity: t.quantity, amountCzk: t.amountCzk, quantityBefore, quantityAfter: ledgerQuantity, averageCostBefore, averageCostAfter, costBasisBefore, costBasisAfter: remainingCostBasisCzk, disposedCostBasis: 0, realizedProfitLoss: null, valid: true })
      continue
    }

    if (t.quantity > ledgerQuantity + EPSILON) {
      invalidTransactionCount += 1
      issues.push({ transactionId: t.id, instrumentId: t.instrumentId, transactionDate: t.transactionDate, code: 'OVERSOLD_POSITION', message: `Prodej ${t.quantity} jednotek překračuje dostupné množství ${ledgerQuantity}.` })
      processed.push({ id: t.id, transactionDate: t.transactionDate, transactionType: t.transactionType, quantity: t.quantity, amountCzk: t.amountCzk, quantityBefore, quantityAfter: quantityBefore, averageCostBefore, averageCostAfter: averageCostBefore, costBasisBefore, costBasisAfter: costBasisBefore, disposedCostBasis: 0, realizedProfitLoss: null, valid: false })
      continue
    }

    const disposedCostBasis = averageCostBefore * t.quantity
    const realized = t.amountCzk - disposedCostBasis
    sellQuantity += t.quantity
    totalSellAmountCzk += t.amountCzk
    realizedProfitLossCzk += realized
    ledgerQuantity = normalizeNumber(ledgerQuantity - t.quantity)
    remainingCostBasisCzk = normalizeNumber(remainingCostBasisCzk - disposedCostBasis)
    if (ledgerQuantity === 0) remainingCostBasisCzk = 0
    const averageCostAfter = ledgerQuantity > 0 ? remainingCostBasisCzk / ledgerQuantity : 0
    processedTransactionCount += 1
    processed.push({ id: t.id, transactionDate: t.transactionDate, transactionType: t.transactionType, quantity: t.quantity, amountCzk: t.amountCzk, quantityBefore, quantityAfter: ledgerQuantity, averageCostBefore, averageCostAfter, costBasisBefore, costBasisAfter: remainingCostBasisCzk, disposedCostBasis, realizedProfitLoss: realized, valid: true })
  }

  return {
    portfolioId: first?.portfolioId ?? '', instrumentId: first?.instrumentId ?? '',
    buyQuantity: normalizeNumber(buyQuantity), sellQuantity: normalizeNumber(sellQuantity),
    ledgerQuantity: normalizeNumber(ledgerQuantity), totalBuyAmountCzk: normalizeNumber(totalBuyAmountCzk),
    totalSellAmountCzk: normalizeNumber(totalSellAmountCzk), remainingCostBasisCzk: normalizeNumber(remainingCostBasisCzk),
    averageCostCzk: ledgerQuantity > 0 ? normalizeNumber(remainingCostBasisCzk / ledgerQuantity) : 0,
    realizedProfitLossCzk: normalizeNumber(realizedProfitLossCzk), incomeFromSalesCzk: normalizeNumber(totalSellAmountCzk),
    processedTransactionCount, invalidTransactionCount, transactions: processed, issues,
  }
}

export function aggregateInvestmentIncome(incomes: InvestmentIncome[]) {
  const summaries = new Map<string, InstrumentIncomeSummary>()
  for (const income of incomes) {
    if (!income.instrumentId || !Number.isFinite(income.amountCzk)) continue
    const current = summaries.get(income.instrumentId) ?? {
      instrumentId: income.instrumentId, dividendIncomeCzk: 0, couponIncomeCzk: 0,
      interestIncomeCzk: 0, investmentIncomeCzk: 0, incomeCount: 0,
    }
    if (income.incomeType === 'DIVIDEND') current.dividendIncomeCzk += income.amountCzk
    if (income.incomeType === 'COUPON') current.couponIncomeCzk += income.amountCzk
    if (income.incomeType === 'INTEREST') current.interestIncomeCzk += income.amountCzk
    current.investmentIncomeCzk = current.dividendIncomeCzk + current.couponIncomeCzk + current.interestIncomeCzk
    current.incomeCount += 1
    summaries.set(income.instrumentId, current)
  }
  return summaries
}

export function calculateInvestmentPerformance(
  ledger: InstrumentLedgerResult,
  currentValueCzk: number,
  income: InstrumentIncomeSummary = {
    instrumentId: ledger.instrumentId, dividendIncomeCzk: 0, couponIncomeCzk: 0,
    interestIncomeCzk: 0, investmentIncomeCzk: 0, incomeCount: 0,
  },
): InstrumentInvestmentPerformance {
  const current = Number.isFinite(currentValueCzk) ? currentValueCzk : 0
  const unrealized = current - ledger.remainingCostBasisCzk
  const total = ledger.realizedProfitLossCzk + unrealized + income.investmentIncomeCzk
  return {
    currentValueCzk: current,
    unrealizedProfitLossCzk: normalizeNumber(unrealized),
    unrealizedReturnPercent: ledger.remainingCostBasisCzk > 0 ? (unrealized / ledger.remainingCostBasisCzk) * 100 : null,
    realizedProfitLossCzk: ledger.realizedProfitLossCzk,
    dividendIncomeCzk: normalizeNumber(income.dividendIncomeCzk),
    couponIncomeCzk: normalizeNumber(income.couponIncomeCzk),
    interestIncomeCzk: normalizeNumber(income.interestIncomeCzk),
    investmentIncomeCzk: normalizeNumber(income.investmentIncomeCzk),
    totalProfitLossCzk: normalizeNumber(total),
    totalReturnPercent: ledger.totalBuyAmountCzk > 0 ? (total / ledger.totalBuyAmountCzk) * 100 : null,
  }
}

export function calculateLedgerByInstrument(transactions: LedgerTransaction[]) {
  const groups = new Map<string, LedgerTransaction[]>()
  for (const t of transactions) {
    const key = `${t.portfolioId}:${t.instrumentId}`
    const items = groups.get(key) ?? []
    items.push(t)
    groups.set(key, items)
  }
  return Array.from(groups.values()).map(calculateInstrumentLedger).sort((a, b) => a.instrumentId.localeCompare(b.instrumentId))
}

export function reconcileLedgerQuantity(instrumentId: string, ledgerQuantity: number, positionQuantity: number | null, tolerance = DEFAULT_TOLERANCE): LedgerReconciliation {
  const normalizedTolerance = Number.isFinite(tolerance) ? Math.max(tolerance, 0) : DEFAULT_TOLERANCE
  if (positionQuantity === null) {
    return { instrumentId, positionQuantity: null, ledgerQuantity, difference: -ledgerQuantity, absoluteDifference: Math.abs(ledgerQuantity), tolerance: normalizedTolerance, status: 'NO_POSITION' }
  }
  const difference = positionQuantity - ledgerQuantity
  const absoluteDifference = Math.abs(difference)
  return { instrumentId, positionQuantity, ledgerQuantity, difference, absoluteDifference, tolerance: normalizedTolerance, status: absoluteDifference <= normalizedTolerance ? 'MATCH' : 'MISMATCH' }
}

export function reconcileLedgerWithPositions(ledgerResults: InstrumentLedgerResult[], positions: LedgerPosition[], tolerance = DEFAULT_TOLERANCE) {
  const byInstrument = new Map(positions.map((p) => [p.instrumentId, p.quantity]))
  const result: LedgerReconciliation[] = []
  const processed = new Set<string>()
  for (const ledger of ledgerResults) {
    processed.add(ledger.instrumentId)
    result.push(reconcileLedgerQuantity(ledger.instrumentId, ledger.ledgerQuantity, byInstrument.has(ledger.instrumentId) ? (byInstrument.get(ledger.instrumentId) ?? null) : null, tolerance))
  }
  for (const position of positions) {
    if (processed.has(position.instrumentId)) continue
    const quantity = position.quantity ?? 0
    result.push({ instrumentId: position.instrumentId, positionQuantity: position.quantity, ledgerQuantity: 0, difference: quantity, absoluteDifference: Math.abs(quantity), tolerance, status: 'NO_LEDGER' })
  }
  return result
}
