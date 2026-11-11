import { describe, expect, it } from 'vitest'
import {
  createImportFingerprint,
  finalizeImportRow,
  mapTransactionType,
  normalizeWorkbookRow,
  resolveInstrument,
  type ImportInstrument,
} from './transactionImport'

const instruments: ImportInstrument[] = [
  { id: 'cez', name: 'ČEZ', ticker: 'CEZ.PR', isin: 'CZ0005112300' },
  { id: 'tabak', name: 'PHILIP MORRIS ČR', ticker: 'TABAK.PR', isin: null },
  { id: 'mrck', name: 'MRCK', ticker: 'MRK', isin: null },
  { id: 'komb', name: 'KOMB', ticker: 'KOMB.PR', isin: 'CZ0008019106' },
]

describe('mapTransactionType', () => {
  it('mapuje české typy', () => {
    expect(mapTransactionType('Nákup')).toBe('BUY')
    expect(mapTransactionType('Prodej')).toBe('SELL')
    expect(mapTransactionType('Výplata dividendy')).toBe('DIVIDEND')
    expect(mapTransactionType('Výplata kupónu')).toBe('COUPON')
    expect(mapTransactionType('Úrok')).toBe('INTEREST')
    expect(mapTransactionType('Vklad')).toBe('DEPOSIT')
    expect(mapTransactionType('Výběr')).toBe('WITHDRAWAL')
  })
})

describe('normalizeWorkbookRow', () => {
  it('spočítá FX a cenu v měně', () => {
    const result = normalizeWorkbookRow({
      rowNumber: 2,
      date: '21.04.2025',
      positionId: 'US67066G1040',
      positionName: 'NVDA',
      transactionType: 'Nákup',
      amountCzk: 211799.03,
      amountCurrency: 9659.28,
      currency: 'USD',
      quantity: 100,
      unitPriceCzk: 2117.9903,
      unitPriceCurrency: 96.5928,
      assetType: 'Akcie',
    }, '2026-11-11')

    expect(result.eventType).toBe('BUY')
    expect(result.fxRate).toBeCloseTo(21.927, 3)
    expect(result.unitPrice).toBeCloseTo(96.5928, 4)
    expect(result.errors).toEqual([])
  })

  it('označí budoucí datum varováním', () => {
    const result = normalizeWorkbookRow({
      rowNumber: 2,
      date: '2027-01-01',
      positionId: '',
      positionName: '',
      transactionType: 'Vklad',
      amountCzk: 1000,
      amountCurrency: null,
      currency: 'CZK',
      quantity: null,
      unitPriceCzk: null,
      unitPriceCurrency: null,
      assetType: '',
    }, '2026-11-11')

    expect(result.warnings).toContain('Datum transakce je v budoucnosti.')
  })
})

describe('resolveInstrument', () => {
  it('použije název MRCK před chybným ISIN KOMB', () => {
    const row = normalizeWorkbookRow({
      rowNumber: 2,
      date: '2024-09-26',
      positionId: 'CZ0008019106',
      positionName: 'MRCK',
      transactionType: 'Nákup',
      amountCzk: 179294.91,
      amountCurrency: 7943.5,
      currency: 'USD',
      quantity: 70,
      unitPriceCzk: 2561.355857,
      unitPriceCurrency: 113.4786,
      assetType: 'Akcie',
    })

    expect(resolveInstrument(row, instruments)?.id).toBe('mrck')
  })

  it('sjednotí alias TABAK s PHILIP MORRIS ČR', () => {
    const row = normalizeWorkbookRow({
      rowNumber: 2,
      date: '2025-07-14',
      positionId: 'CS0008418869',
      positionName: 'TABAK',
      transactionType: 'Výplata dividendy',
      amountCzk: 10370,
      amountCurrency: null,
      currency: 'CZK',
      quantity: 10,
      unitPriceCzk: 1037,
      unitPriceCurrency: null,
      assetType: 'Akcie',
    })

    expect(resolveInstrument(row, instruments)?.id).toBe('tabak')
  })
})

describe('finalizeImportRow', () => {
  it('označí existující řádek', () => {
    const row = normalizeWorkbookRow({
      rowNumber: 2,
      date: '2026-08-03',
      positionId: 'CZ0005112300',
      positionName: 'CEZ',
      transactionType: 'Výplata dividendy',
      amountCzk: 35700,
      amountCurrency: null,
      currency: 'CZK',
      quantity: 1000,
      unitPriceCzk: 35.7,
      unitPriceCurrency: null,
      assetType: 'Akcie',
    })

    const fingerprint = createImportFingerprint({
      transactionDate: '2026-08-03',
      eventType: 'DIVIDEND',
      instrumentId: 'cez',
      quantity: 1000,
      amountCzk: 35700,
      currency: 'CZK',
    })

    expect(finalizeImportRow(row, instruments, new Set([fingerprint])).status).toBe('EXISTS')
  })
})
