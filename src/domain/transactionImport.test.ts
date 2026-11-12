import { describe, expect, it } from 'vitest'
import {
  finalizeImportRow,
  normalizeWorkbookRow,
  type ImportInstrument,
  type WorkbookCashflowRow,
} from './transactionImport'

const instruments: ImportInstrument[] = [
  { id: 'cez', name: 'ČEZ', ticker: 'CEZ.PR', isin: 'CZ0005112300', asset_type: 'Akcie' },
  { id: 'cash-eur', name: 'Hotovost EUR', ticker: 'CASH.EUR', isin: null, asset_type: 'Hotovost' },
  { id: 'savings', name: 'RB Spořicí účet', ticker: null, isin: null, asset_type: 'Hotovost' },
  { id: 'tabak', name: 'PHILIP MORRIS ČR', ticker: 'TABAK.PR', isin: 'CS0008418869', asset_type: 'Akcie' },
]

function workbookRow(overrides: Partial<WorkbookCashflowRow> = {}): WorkbookCashflowRow {
  return {
    rowNumber: 2,
    date: '2026-11-01',
    positionId: 'CZ0005112300',
    positionName: 'ČEZ',
    transactionType: 'Nákup',
    amountCzk: 100000,
    amountCurrency: 100000,
    currency: 'CZK',
    quantity: 100,
    unitPriceCzk: 1000,
    unitPriceCurrency: 1000,
    assetType: 'Akcie',
    ...overrides,
  }
}

describe('transaction import v2', () => {
  it('ponechá investiční BUY jako nový řádek', () => {
    const normalized = normalizeWorkbookRow(workbookRow())
    const result = finalizeImportRow(normalized, instruments, new Set())
    expect(result.status).toBe('NEW')
    expect(result.instrumentId).toBe('cez')
  })

  it('přeskočí historický BUY hotovosti', () => {
    const normalized = normalizeWorkbookRow(workbookRow({
      positionId: '',
      positionName: 'Hotovost EUR',
      currency: 'EUR',
      amountCzk: 24390,
      amountCurrency: 1000,
      quantity: 1000,
      unitPriceCzk: 24.39,
      unitPriceCurrency: 1,
      assetType: 'Hotovost',
    }))
    const result = finalizeImportRow(normalized, instruments, new Set())
    expect(result.status).toBe('SKIPPED')
    expect(result.skipReason).toContain('neimportuje jako BUY/SELL')
  })

  it('přeskočí historický BUY spořicího účtu', () => {
    const normalized = normalizeWorkbookRow(workbookRow({
      positionId: '',
      positionName: 'RB Spořicí účet',
      amountCzk: 500000,
      amountCurrency: 500000,
      quantity: 1,
      unitPriceCzk: 500000,
      unitPriceCurrency: 500000,
      assetType: 'Hotovost',
    }))
    expect(finalizeImportRow(normalized, instruments, new Set()).status).toBe('SKIPPED')
  })

  it('rozpozná alias TABAK', () => {
    const normalized = normalizeWorkbookRow(workbookRow({
      positionId: '',
      positionName: 'TABAK',
      assetType: 'Akcie',
    }))
    expect(finalizeImportRow(normalized, instruments, new Set()).instrumentId).toBe('tabak')
  })
})
