import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import {
  createImportFingerprint,
  finalizeImportRow,
  normalizeWorkbookRow,
  type ImportInstrument,
  type ResolvedImportRow,
  type WorkbookCashflowRow,
} from '../domain/transactionImport'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

type SheetRow = Record<string, unknown>

type ExistingTransactionRow = {
  transaction_date: string
  transaction_type: string
  instrument_id: string
  quantity: number | string
  amount_czk: number | string
  currency: string
}

type ExistingCashflowRow = {
  transaction_date: string
  transaction_type: string
  instrument_id: string | null
  shares: number | string | null
  amount_czk: number | string
  currency: string
}

export type ImportDryRun = {
  fileName: string
  sheetName: string
  rows: ResolvedImportRow[]
  totalCount: number
  newCount: number
  existingCount: number
  warningCount: number
  errorCount: number
}

function value(row: SheetRow, name: string) {
  return row[name]
}

function toWorkbookRow(row: SheetRow, index: number): WorkbookCashflowRow {
  return {
    rowNumber: index + 2,
    date: value(row, 'Datum'),
    positionId: value(row, 'PoziceID'),
    positionName: value(row, 'NázevPozice'),
    transactionType: value(row, 'TypTransakce'),
    amountCzk: value(row, 'ČástkaCZK'),
    amountCurrency: value(row, 'ČástkaMěna'),
    currency: value(row, 'Měna'),
    quantity: value(row, 'PočetKs'),
    unitPriceCzk: value(row, 'CenaZaKsCZK'),
    unitPriceCurrency: value(row, 'CenaZaKsMěna'),
    assetType: value(row, 'TypAktiva'),
  }
}

function number(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.abs(parsed) : null
}

function normalizeCashflowType(value: string) {
  if (value === 'CONTRIBUTION') return 'DEPOSIT'
  return value
}

async function loadDryRunContext() {
  const [instrumentResult, transactionResult, cashflowResult] = await Promise.all([
    supabase.from('instruments').select('id,name,ticker,isin').order('name'),
    supabase.from('transactions').select('transaction_date,transaction_type,instrument_id,quantity,amount_czk,currency').eq('portfolio_id', PORTFOLIO_ID),
    supabase.from('cashflows').select('transaction_date,transaction_type,instrument_id,shares,amount_czk,currency').eq('portfolio_id', PORTFOLIO_ID),
  ])

  if (instrumentResult.error) throw instrumentResult.error
  if (transactionResult.error) throw transactionResult.error
  if (cashflowResult.error) throw cashflowResult.error

  const instruments = (instrumentResult.data ?? []) as ImportInstrument[]
  const fingerprints = new Set<string>()

  for (const row of (transactionResult.data ?? []) as ExistingTransactionRow[]) {
    fingerprints.add(createImportFingerprint({
      transactionDate: row.transaction_date,
      eventType: row.transaction_type === 'SELL' ? 'SELL' : 'BUY',
      instrumentId: row.instrument_id,
      quantity: number(row.quantity),
      amountCzk: number(row.amount_czk),
      currency: row.currency,
    }))
  }

  for (const row of (cashflowResult.data ?? []) as ExistingCashflowRow[]) {
    const eventType = normalizeCashflowType(row.transaction_type)
    if (!['DIVIDEND', 'COUPON', 'INTEREST', 'DEPOSIT', 'WITHDRAWAL'].includes(eventType)) continue

    fingerprints.add(createImportFingerprint({
      transactionDate: row.transaction_date,
      eventType: eventType as 'DIVIDEND' | 'COUPON' | 'INTEREST' | 'DEPOSIT' | 'WITHDRAWAL',
      instrumentId: row.instrument_id,
      quantity: number(row.shares),
      amountCzk: number(row.amount_czk),
      currency: row.currency,
    }))
  }

  return { instruments, fingerprints }
}

export async function analyzeTransactionWorkbook(file: File): Promise<ImportDryRun> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames.includes('CashFlow')
    ? 'CashFlow'
    : workbook.SheetNames[0]

  if (!sheetName) throw new Error('Excel neobsahuje žádný list.')

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    defval: null,
    raw: true,
  })

  const requiredHeaders = [
    'Datum',
    'PoziceID',
    'NázevPozice',
    'TypTransakce',
    'ČástkaCZK',
    'Měna',
  ]

  if (rawRows.length > 0) {
    const first = rawRows[0]
    const missing = requiredHeaders.filter((header) => !(header in first))
    if (missing.length > 0) {
      throw new Error(`Chybí povinné sloupce: ${missing.join(', ')}.`)
    }
  }

  const { instruments, fingerprints } = await loadDryRunContext()
  const rows = rawRows
    .map(toWorkbookRow)
    .map((row) => normalizeWorkbookRow(row))
    .map((row) => finalizeImportRow(row, instruments, fingerprints))

  return {
    fileName: file.name,
    sheetName,
    rows,
    totalCount: rows.length,
    newCount: rows.filter((row) => row.status === 'NEW').length,
    existingCount: rows.filter((row) => row.status === 'EXISTS').length,
    warningCount: rows.filter((row) => row.status === 'WARNING').length,
    errorCount: rows.filter((row) => row.status === 'ERROR').length,
  }
}

export type HistoricalImportResult = {
  importedCount: number
  skippedCount: number
  failedCount: number
  errors: Array<{
    rowNumber: number
    message: string
  }>
}

function historicalExternalId(row: ResolvedImportRow) {
  return `xlsx:${createImportFingerprint({
    transactionDate: row.transactionDate,
    eventType: row.eventType,
    instrumentId: row.instrumentId,
    quantity: row.quantity,
    amountCzk: row.amountCzk,
    currency: row.currency,
  })}`
}

async function importHistoricalTrade(row: ResolvedImportRow) {
  if (!row.instrumentId || !row.eventType || !row.quantity || !row.unitPrice || !row.fxRate || !row.amountCzk) {
    throw new Error('Řádek nemá všechna povinná data obchodu.')
  }

  const { error } = await supabase
    .from('transactions')
    .insert({
      portfolio_id: PORTFOLIO_ID,
      instrument_id: row.instrumentId,
      transaction_date: row.transactionDate,
      transaction_type: row.eventType,
      quantity: row.quantity,
      unit_price: row.unitPrice,
      currency: row.currency,
      fx_rate: row.fxRate,
      fees_czk: 0,
      tax_czk: 0,
      amount_czk: row.amountCzk,
      source: 'xlsx-historical',
      external_id: historicalExternalId(row),
      note: 'Historický import z Excelu. Pozice nebyla automaticky změněna.',
    })

  if (error) throw error
}

async function importHistoricalCashflow(row: ResolvedImportRow) {
  if (!row.eventType || !row.amountCzk) {
    throw new Error('Řádek nemá všechna povinná data cashflow.')
  }

  const isExternal = row.eventType === 'DEPOSIT' || row.eventType === 'WITHDRAWAL'
  const amountCzk = row.eventType === 'WITHDRAWAL'
    ? -Math.abs(row.amountCzk)
    : Math.abs(row.amountCzk)

  const { error } = await supabase
    .from('cashflows')
    .insert({
      portfolio_id: PORTFOLIO_ID,
      instrument_id: isExternal ? null : row.instrumentId,
      transaction_date: row.transactionDate,
      transaction_type: row.eventType,
      shares: row.quantity,
      price_per_unit: row.unitPriceCzk,
      currency: row.currency,
      fx_rate: row.fxRate ?? 1,
      amount_czk: amountCzk,
      is_external: isExternal,
      note: `Historický import z Excelu, řádek ${row.rowNumber}.`,
    })

  if (error) throw error
}

export async function importNewHistoricalRows(
  rows: ResolvedImportRow[],
): Promise<HistoricalImportResult> {
  const importable = rows.filter((row) => row.status === 'NEW')
  const errors: HistoricalImportResult['errors'] = []
  let importedCount = 0

  for (const row of importable) {
    try {
      if (row.eventType === 'BUY' || row.eventType === 'SELL') {
        await importHistoricalTrade(row)
      } else {
        await importHistoricalCashflow(row)
      }
      importedCount += 1
    } catch (reason) {
      errors.push({
        rowNumber: row.rowNumber,
        message: reason instanceof Error ? reason.message : String(reason),
      })
    }
  }

  return {
    importedCount,
    skippedCount: rows.length - importable.length,
    failedCount: errors.length,
    errors,
  }
}
