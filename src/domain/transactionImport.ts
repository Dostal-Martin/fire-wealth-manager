export type ImportEventType = 'BUY' | 'SELL' | 'DIVIDEND' | 'COUPON' | 'INTEREST' | 'DEPOSIT' | 'WITHDRAWAL'
export type ImportStatus = 'NEW' | 'EXISTS' | 'SKIPPED' | 'WARNING' | 'ERROR'

export type WorkbookCashflowRow = {
  rowNumber: number; date: unknown; positionId: unknown; positionName: unknown; transactionType: unknown
  amountCzk: unknown; amountCurrency: unknown; currency: unknown; quantity: unknown
  unitPriceCzk: unknown; unitPriceCurrency: unknown; assetType: unknown
}

export type NormalizedImportRow = {
  rowNumber: number; transactionDate: string; eventType: ImportEventType | null; sourceType: string
  positionId: string; positionName: string; amountCzk: number | null; amountCurrency: number | null
  currency: string; quantity: number | null; unitPriceCzk: number | null; unitPriceCurrency: number | null
  unitPrice: number | null; fxRate: number | null; assetType: string; requiresInstrument: boolean
  warnings: string[]; errors: string[]
}

export type ImportInstrument = {
  id: string; name: string; ticker: string | null; isin: string | null; asset_type: string | null
}

export type ResolvedImportRow = NormalizedImportRow & {
  instrumentId: string | null; instrumentName: string | null; instrumentAssetType: string | null
  status: ImportStatus; duplicate: boolean; skipReason: string | null
}

const TYPE_MAP: Record<string, ImportEventType> = {
  NAKUP: 'BUY', BUY: 'BUY', PRODEJ: 'SELL', SELL: 'SELL',
  VYPLATADIVIDENDY: 'DIVIDEND', DIVIDENDA: 'DIVIDEND', DIVIDEND: 'DIVIDEND',
  VYPLATAKUPONU: 'COUPON', KUPON: 'COUPON', COUPON: 'COUPON',
  VYPLATAUROKU: 'INTEREST', UROK: 'INTEREST', INTEREST: 'INTEREST',
  VKLAD: 'DEPOSIT', PRISPEVEK: 'DEPOSIT', CONTRIBUTION: 'DEPOSIT', DEPOSIT: 'DEPOSIT',
  VYBER: 'WITHDRAWAL', WITHDRAWAL: 'WITHDRAWAL',
}

function stripDiacritics(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '') }
export function normalizeText(value: unknown) { return String(value ?? '').trim() }
export function normalizeKey(value: unknown) { return stripDiacritics(normalizeText(value)).toUpperCase().replace(/[^A-Z0-9]/g, '') }
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(String(value).replace(/\s/g, '').replace(/\u00a0/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}
export function parseDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000).toISOString().slice(0, 10)
  }
  const text = normalizeText(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const match = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/)
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : ''
}
export function mapTransactionType(value: unknown): ImportEventType | null { return TYPE_MAP[normalizeKey(value)] ?? null }

export function normalizeWorkbookRow(row: WorkbookCashflowRow, today = new Date().toISOString().slice(0, 10)): NormalizedImportRow {
  const transactionDate = parseDate(row.date)
  const sourceType = normalizeText(row.transactionType)
  const eventType = mapTransactionType(row.transactionType)
  const amountCzk = parseNumber(row.amountCzk)
  const amountCurrency = parseNumber(row.amountCurrency)
  const quantity = parseNumber(row.quantity)
  const unitPriceCzk = parseNumber(row.unitPriceCzk)
  const unitPriceCurrency = parseNumber(row.unitPriceCurrency)
  const currency = normalizeText(row.currency).toUpperCase() || 'CZK'
  const positionId = normalizeText(row.positionId)
  const positionName = normalizeText(row.positionName)
  const assetType = normalizeText(row.assetType)
  const warnings: string[] = []
  const errors: string[] = []
  const requiresInstrument = !['DEPOSIT', 'WITHDRAWAL'].includes(eventType ?? '')

  if (!transactionDate) errors.push('Neplatné datum.')
  if (!eventType) errors.push(`Nepodporovaný typ: ${sourceType || 'prázdný'}.`)
  if (amountCzk === null || amountCzk === 0) errors.push('Chybí platná částka CZK.')
  if (!/^[A-Z]{3}$/.test(currency)) errors.push('Neplatný kód měny.')
  if (requiresInstrument && !positionId && !positionName) errors.push('Chybí identifikace instrumentu.')
  if (eventType === 'BUY' || eventType === 'SELL') {
    if (quantity === null || quantity <= 0) errors.push('Obchod nemá platné množství.')
    if (unitPriceCzk === null && unitPriceCurrency === null) errors.push('Obchod nemá jednotkovou cenu.')
  }
  if (transactionDate && transactionDate > today) warnings.push('Datum transakce je v budoucnosti.')

  let fxRate: number | null = currency === 'CZK' ? 1 : null
  if (currency !== 'CZK' && amountCzk !== null && amountCurrency !== null && amountCurrency !== 0) {
    fxRate = Math.abs(amountCzk / amountCurrency)
  }
  const unitPrice = currency === 'CZK' ? unitPriceCzk : unitPriceCurrency ?? (unitPriceCzk !== null && fxRate ? unitPriceCzk / fxRate : null)
  if ((eventType === 'BUY' || eventType === 'SELL') && (fxRate === null || fxRate <= 0)) errors.push('Nelze určit FX kurz obchodu.')

  return {
    rowNumber: row.rowNumber, transactionDate, eventType, sourceType, positionId, positionName,
    amountCzk: amountCzk === null ? null : Math.abs(amountCzk), amountCurrency: amountCurrency === null ? null : Math.abs(amountCurrency),
    currency, quantity: quantity === null ? null : Math.abs(quantity), unitPriceCzk: unitPriceCzk === null ? null : Math.abs(unitPriceCzk),
    unitPriceCurrency: unitPriceCurrency === null ? null : Math.abs(unitPriceCurrency), unitPrice: unitPrice === null ? null : Math.abs(unitPrice),
    fxRate, assetType, requiresInstrument, warnings, errors,
  }
}

const NAME_ALIASES: Record<string, string[]> = { TABAK: ['TABAK', 'TABAKPR', 'PHILIPMORRISCR'], CEZ: ['CEZ', 'CEZPR'], MRCK: ['MRCK', 'MRK'] }
function nameCandidates(row: NormalizedImportRow) { const key = normalizeKey(row.positionName); return new Set([key, ...(NAME_ALIASES[key] ?? [key])]) }
export function resolveInstrument(row: NormalizedImportRow, instruments: ImportInstrument[]) {
  if (!row.requiresInstrument) return null
  const rowId = normalizeKey(row.positionId)
  const candidates = nameCandidates(row)
  return instruments.find((instrument) => rowId && normalizeKey(instrument.isin) === rowId && (candidates.has(normalizeKey(instrument.name)) || candidates.has(normalizeKey(instrument.ticker))))
    ?? instruments.find((instrument) => candidates.has(normalizeKey(instrument.name)) || candidates.has(normalizeKey(instrument.ticker)))
    ?? instruments.find((instrument) => rowId && normalizeKey(instrument.isin) === rowId)
    ?? null
}
function fixed(value: number | null, digits = 4) { return value === null ? '' : value.toFixed(digits) }
export function createImportFingerprint(row: { transactionDate: string; eventType: ImportEventType | null; instrumentId: string | null; quantity: number | null; amountCzk: number | null; currency: string }) {
  return [row.transactionDate, row.eventType ?? '', row.instrumentId ?? '', fixed(row.quantity, 6), fixed(row.amountCzk, 2), row.currency].join('|')
}

export function createEconomicImportFingerprint(row: {
  transactionDate: string
  eventType: ImportEventType | null
  instrumentIdentity: string
  quantity: number | null
  amountCzk: number | null
  currency: string
}) {
  return [
    row.transactionDate,
    row.eventType ?? '',
    normalizeKey(row.instrumentIdentity),
    fixed(row.quantity, 6),
    fixed(row.amountCzk, 2),
    row.currency.toUpperCase(),
  ].join('|')
}
export function finalizeImportRow(row: NormalizedImportRow, instruments: ImportInstrument[], existingFingerprints: Set<string>, existingEconomicFingerprints: Set<string> = new Set()): ResolvedImportRow {
  const instrument = resolveInstrument(row, instruments)
  const errors = [...row.errors]
  if (row.requiresInstrument && !instrument) errors.push(`Instrument „${row.positionName || row.positionId}“ nebyl nalezen.`)

  const isCash = normalizeKey(instrument?.asset_type ?? row.assetType) === 'HOTOVOST'
  const cashTrade = isCash && (row.eventType === 'BUY' || row.eventType === 'SELL')
  const skipReason = cashTrade
    ? 'Hotovostní nebo spořicí účet se neimportuje jako BUY/SELL. Bez známého zdroje a cíle nelze bezpečně vytvořit historický interní převod.'
    : null

  const strictDuplicate = existingFingerprints.has(createImportFingerprint({ ...row, instrumentId: instrument?.id ?? null }))
  const economicDuplicate = existingEconomicFingerprints.has(createEconomicImportFingerprint({
    transactionDate: row.transactionDate,
    eventType: row.eventType,
    instrumentIdentity: instrument?.isin || instrument?.ticker || instrument?.name || row.positionId || row.positionName,
    quantity: row.quantity,
    amountCzk: row.amountCzk,
    currency: row.currency,
  }))
  const duplicate = strictDuplicate || economicDuplicate
  let status: ImportStatus = 'NEW'
  if (errors.length > 0) status = 'ERROR'
  else if (cashTrade) status = 'SKIPPED'
  else if (duplicate) status = 'EXISTS'
  else if (row.warnings.length > 0) status = 'WARNING'

  return {
    ...row, errors, instrumentId: instrument?.id ?? null, instrumentName: instrument?.name ?? null,
    instrumentAssetType: instrument?.asset_type ?? null, duplicate, status, skipReason,
    warnings: skipReason ? [...row.warnings, skipReason] : row.warnings,
  }
}
