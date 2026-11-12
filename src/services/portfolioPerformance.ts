import { supabase } from '../lib/supabase'
import {
  calculatePricePeriod,
  type PerformancePeriod,
  type PerformanceQuality,
  type PricePoint,
} from '../domain/performanceHistory'
import {
  aggregatePortfolioPeriodReturns,
  calculateInstrumentPeriodReturn,
  type InstrumentPeriodReturn,
} from '../domain/portfolioTotalReturn'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type PortfolioPeriodPerformance = {
  period: PerformancePeriod
  endDate: string
  quality: PerformanceQuality
  startMarketValueCzk: number
  endMarketValueCzk: number
  buyCashCzk: number
  sellCashCzk: number
  dividendIncomeCzk: number
  couponIncomeCzk: number
  interestIncomeCzk: number
  investmentIncomeCzk: number
  profitCzk: number
  returnPercent: number | null
  unavailableInstrumentCount: number
  partialInstrumentCount: number
  instruments: InstrumentPeriodReturn[]
}

type InstrumentRow = {
  id: string
  name: string
  ticker: string | null
  currency: string | null
  asset_type: string | null
}

type TransactionRow = {
  instrument_id: string
  transaction_date: string
  transaction_type: 'BUY' | 'SELL'
  quantity: number | string
  amount_czk: number | string
}

type CashflowRow = {
  instrument_id: string | null
  transaction_date: string
  transaction_type: string
  amount_czk: number | string
}

type PriceRow = {
  instrument_id: string
  price_date: string
  close_price: number | string
}

type FxRow = {
  currency_pair: string
  fx_date: string
  fx_rate: number | string
}


async function fetchAllRows<T>(
  createQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await createQuery(from, from + pageSize - 1)
    if (error) throw error

    const page = data ?? []
    rows.push(...page)

    if (page.length < pageSize) break
  }

  return rows
}

function historyStartForPeriod(period: PerformancePeriod) {
  const now = new Date()
  const year = now.getFullYear()
  if (period === 'YTD') return `${year - 1}-12-15`
  const years = period === '1M' ? 1 : period === '3M' ? 1 : period === '6M' ? 1 : period === '1Y' ? 2 : period === '3Y' ? 4 : period === '5Y' ? 6 : 30
  return `${year - years}-01-01`
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function quantityAtDate(transactions: TransactionRow[], date: string) {
  return transactions
    .filter((row) => row.transaction_date <= date)
    .reduce((sum, row) => sum + (row.transaction_type === 'BUY' ? number(row.quantity) : -number(row.quantity)), 0)
}

function latestFx(rows: FxRow[], pair: string, date: string) {
  const candidates = rows.filter((row) => row.currency_pair === pair && row.fx_date <= date)
  return number(candidates.at(-1)?.fx_rate) || 1
}

function czkPricePoints(
  instrument: InstrumentRow,
  prices: PriceRow[],
  fxRows: FxRow[],
): PricePoint[] {
  const currency = (instrument.currency ?? 'CZK').toUpperCase()
  return prices
    .filter((row) => row.instrument_id === instrument.id)
    .map((row) => ({
      date: row.price_date,
      value: number(row.close_price) * (currency === 'CZK' ? 1 : latestFx(fxRows, `${currency}CZK`, row.price_date)),
    }))
    .filter((row) => row.value > 0)
}

function latestPointAtOrBefore(points: PricePoint[], date: string) {
  return points.filter((point) => point.date <= date).at(-1) ?? null
}

export async function getPortfolioPeriodPerformance(
  period: PerformancePeriod,
): Promise<PortfolioPeriodPerformance> {
  const [instrumentResult, transactionResult, cashflowResult, prices, fxRows] = await Promise.all([
    supabase.from('instruments').select('id,name,ticker,currency,asset_type').order('name'),
    supabase.from('transactions').select('instrument_id,transaction_date,transaction_type,quantity,amount_czk').eq('portfolio_id', PORTFOLIO_ID).order('transaction_date'),
    supabase.from('cashflows').select('instrument_id,transaction_date,transaction_type,amount_czk').eq('portfolio_id', PORTFOLIO_ID).eq('is_external', false).order('transaction_date'),
    fetchAllRows<PriceRow>((from, to) =>
      supabase
        .from('price_history')
        .select('instrument_id,price_date,close_price')
        .gte('price_date', historyStartForPeriod(period))
        .order('price_date', { ascending: true })
        .order('instrument_id', { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<FxRow>((from, to) =>
      supabase
        .from('fx_history')
        .select('currency_pair,fx_date,fx_rate')
        .gte('fx_date', historyStartForPeriod(period))
        .order('fx_date', { ascending: true })
        .order('currency_pair', { ascending: true })
        .range(from, to),
    ),
  ])

  if (instrumentResult.error) throw instrumentResult.error
  if (transactionResult.error) throw transactionResult.error
  if (cashflowResult.error) throw cashflowResult.error

  const instruments = (instrumentResult.data ?? []) as InstrumentRow[]
  const transactions = (transactionResult.data ?? []) as TransactionRow[]
  const cashflows = (cashflowResult.data ?? []) as CashflowRow[]

  const endDate = [
    ...prices.map((row) => row.price_date),
    ...transactions.map((row) => row.transaction_date),
    ...cashflows.map((row) => row.transaction_date),
  ].reduce((latest, date) => date > latest ? date : latest, '')

  if (!endDate) throw new Error('Chybí historie pro výpočet výkonnosti.')

  const investmentInstrumentIds = new Set([
    ...transactions.map((row) => row.instrument_id),
    ...cashflows
      .filter((row) =>
        row.instrument_id !== null &&
        ['DIVIDEND', 'COUPON', 'INTEREST', 'COUPON_PAYMENT', 'INTEREST_PAYMENT']
          .includes(row.transaction_type),
      )
      .map((row) => row.instrument_id as string),
  ])
  const rows: InstrumentPeriodReturn[] = []

  for (const instrument of instruments) {
    if (!investmentInstrumentIds.has(instrument.id)) continue
    if ((instrument.asset_type ?? '').toLocaleLowerCase('cs') === 'hotovost') continue

    const instrumentTransactions = transactions.filter((row) => row.instrument_id === instrument.id)
    const points = czkPricePoints(instrument, prices, fxRows)
    const boundary = calculatePricePeriod(period, points)

    let quality = boundary.quality
    let qualityReason = boundary.reason
    let startValue: number | null = null
    let endValue: number | null = null

    if (boundary.effectiveStartDate && boundary.endDate) {
      const startPoint = latestPointAtOrBefore(points, boundary.effectiveStartDate)
      const endPoint = latestPointAtOrBefore(points, boundary.endDate)
      const startQuantity = quantityAtDate(instrumentTransactions, boundary.effectiveStartDate)
      const endQuantity = quantityAtDate(instrumentTransactions, boundary.endDate)

      if (startPoint && endPoint) {
        startValue = Math.max(0, startQuantity) * startPoint.value
        endValue = Math.max(0, endQuantity) * endPoint.value
      }
    }

    // Instrument koupený až uvnitř období může mít na začátku správně nulovou hodnotu.
    const firstTransactionDate = instrumentTransactions[0]?.transaction_date ?? null
    if (
      boundary.requestedStartDate &&
      firstTransactionDate &&
      firstTransactionDate > boundary.requestedStartDate &&
      boundary.endDate >= firstTransactionDate
    ) {
      startValue = 0
      if (quality === 'UNAVAILABLE' && points.length > 0) {
        quality = 'PARTIAL'
        qualityReason = `Instrument vstoupil do portfolia ${firstTransactionDate}.`
      }
    }

    const instrumentIncomes = cashflows
      .filter((row) => row.instrument_id === instrument.id && ['DIVIDEND', 'COUPON', 'INTEREST', 'COUPON_PAYMENT', 'INTEREST_PAYMENT'].includes(row.transaction_type))
      .map((row) => ({
        transactionDate: row.transaction_date,
        incomeType: (row.transaction_type === 'COUPON_PAYMENT' ? 'COUPON' : row.transaction_type === 'INTEREST_PAYMENT' ? 'INTEREST' : row.transaction_type) as 'DIVIDEND' | 'COUPON' | 'INTEREST',
        amountCzk: number(row.amount_czk),
      }))

    rows.push(calculateInstrumentPeriodReturn({
      instrumentId: instrument.id,
      instrumentName: instrument.name,
      period,
      requestedStartDate: boundary.requestedStartDate,
      effectiveStartDate: boundary.effectiveStartDate ?? boundary.requestedStartDate,
      endDate: boundary.endDate,
      startMarketValueCzk: startValue,
      endMarketValueCzk: endValue,
      transactions: instrumentTransactions.map((row) => ({
        transactionDate: row.transaction_date,
        transactionType: row.transaction_type,
        quantity: number(row.quantity),
        amountCzk: number(row.amount_czk),
      })),
      incomes: instrumentIncomes,
      quality,
      qualityReason,
    }))
  }

  const aggregate = aggregatePortfolioPeriodReturns(rows)

  const periodStart = rows
    .map((row) => row.startDate)
    .filter((date): date is string => Boolean(date))
    .sort()[0] ?? null

  const periodCashflows = cashflows.filter((row) =>
    (!periodStart || row.transaction_date >= periodStart) &&
    row.transaction_date <= endDate &&
    ['DIVIDEND', 'COUPON', 'INTEREST', 'COUPON_PAYMENT', 'INTEREST_PAYMENT']
      .includes(row.transaction_type),
  )

  const dividendIncomeCzk = periodCashflows
    .filter((row) => row.transaction_type === 'DIVIDEND')
    .reduce((sum, row) => sum + number(row.amount_czk), 0)

  const couponIncomeCzk = periodCashflows
    .filter((row) => ['COUPON', 'COUPON_PAYMENT'].includes(row.transaction_type))
    .reduce((sum, row) => sum + number(row.amount_czk), 0)

  const interestIncomeCzk = periodCashflows
    .filter((row) => ['INTEREST', 'INTEREST_PAYMENT'].includes(row.transaction_type))
    .reduce((sum, row) => sum + number(row.amount_czk), 0)

  const investmentIncomeCzk = dividendIncomeCzk + couponIncomeCzk + interestIncomeCzk
  const marketProfitWithoutIncome = aggregate.profitCzk - aggregate.investmentIncomeCzk
  const profitCzk = marketProfitWithoutIncome + investmentIncomeCzk
  const capitalBase = aggregate.startMarketValueCzk + aggregate.buyCashCzk

  return {
    period,
    endDate,
    ...aggregate,
    dividendIncomeCzk,
    couponIncomeCzk,
    interestIncomeCzk,
    investmentIncomeCzk,
    profitCzk,
    returnPercent: capitalBase > 0 ? (profitCzk / capitalBase) * 100 : null,
    instruments: rows.sort((a, b) => (b.profitCzk ?? -Infinity) - (a.profitCzk ?? -Infinity)),
  }
}
