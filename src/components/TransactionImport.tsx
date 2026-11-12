import { useState } from 'react'
import {
  analyzeTransactionWorkbook,
  importNewHistoricalRows,
  type HistoricalImportResult,
  type ImportDryRun,
} from '../services/transactionImport'
import type { ImportStatus } from '../domain/transactionImport'

function statusLabel(status: ImportStatus) {
  if (status === 'NEW') return 'Nový'
  if (status === 'EXISTS') return 'Již existuje'
  if (status === 'SKIPPED') return 'Přeskočeno'
  if (status === 'WARNING') return 'Varování'
  return 'Chyba'
}
function statusColor(status: ImportStatus) {
  if (status === 'NEW') return '#416653'
  if (status === 'EXISTS') return 'var(--text-muted)'
  if (status === 'SKIPPED') return '#5e6570'
  if (status === 'WARNING') return '#84611f'
  return '#8b4444'
}
function formatMoney(value: number | null) {
  return value === null ? '—' : value.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 2 })
}

export default function TransactionImport({ onImported }: { onImported?: () => void }) {
  const [result, setResult] = useState<ImportDryRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<ImportStatus | 'ALL'>('ALL')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<HistoricalImportResult | null>(null)

  async function selectFile(file: File | undefined) {
    if (!file) return
    try {
      setLoading(true); setSelectedFile(file); setImportResult(null); setError('')
      setResult(await analyzeTransactionWorkbook(file))
    } catch (reason) {
      console.error('Dry-run importu:', reason)
      setError(reason instanceof Error ? reason.message : 'Excel se nepodařilo analyzovat.')
      setResult(null)
    } finally { setLoading(false) }
  }

  async function importRows() {
    if (!result || !selectedFile || result.newCount === 0) return
    const confirmed = window.confirm(
      `Importovat ${result.newCount} nových historických záznamů? Hotovostní BUY/SELL jsou přeskočené. Historické BUY/SELL doplní pouze transactions a nezmění dnešní positions.`,
    )
    if (!confirmed) return
    try {
      setImporting(true); setError('')
      const imported = await importNewHistoricalRows(result.rows)
      setImportResult(imported)
      setResult(await analyzeTransactionWorkbook(selectedFile))
      onImported?.()
    } catch (reason) {
      console.error('Historický import:', reason)
      setError(reason instanceof Error ? reason.message : 'Historický import se nepodařilo dokončit.')
    } finally { setImporting(false) }
  }

  const visibleRows = result?.rows.filter((row) => statusFilter === 'ALL' || row.status === statusFilter) ?? []

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Kontrola importu z Excelu</h2>
          <div className="panel-subtitle">
            Dry-run investičních transakcí a cashflow. Hotovostní a spořicí účty se nikdy neimportují jako BUY/SELL.
          </div>
        </div>
        <label className="button-secondary" style={{ cursor: 'pointer' }}>
          {loading ? 'Analyzuji...' : 'Vybrat Excel'}
          <input type="file" accept=".xlsx,.xls" disabled={loading} style={{ display: 'none' }} onChange={(event) => void selectFile(event.target.files?.[0])} />
        </label>
      </div>

      {error && <div className="error-box" style={{ margin: '16px' }}>{error}</div>}

      {result && (
        <>
          <div className="panel-body">
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'end' }}>
              <Summary label="Řádků" value={result.totalCount} />
              <Summary label="Nových" value={result.newCount} color="#416653" />
              <Summary label="Existujících" value={result.existingCount} />
              <Summary label="Přeskočeno" value={result.skippedCount} color="#5e6570" />
              <Summary label="Varování" value={result.warningCount} color="#84611f" />
              <Summary label="Chyb" value={result.errorCount} color="#8b4444" />

              {result.newCount > 0 && result.errorCount === 0 && (
                <button className="button-primary" type="button" disabled={importing} onClick={() => void importRows()} style={{ marginLeft: 'auto' }}>
                  {importing ? 'Importuji...' : `Importovat ${result.newCount} nových`}
                </button>
              )}

              <label style={{ minWidth: '170px' }}>
                <span className="form-label">Zobrazit</span>
                <select className="form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ImportStatus | 'ALL')}>
                  <option value="ALL">Všechny řádky</option>
                  <option value="NEW">Nové</option>
                  <option value="EXISTS">Již existují</option>
                  <option value="SKIPPED">Přeskočené</option>
                  <option value="WARNING">Varování</option>
                  <option value="ERROR">Chyby</option>
                </select>
              </label>
            </div>
            <div style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5 }}>
              Soubor: {result.fileName} · list: {result.sheetName}. Přeskočené hotovostní řádky se nezapisují. Bez známého zdrojového a cílového účtu se historický interní převod nevytváří.
            </div>
          </div>

          {importResult && (
            <div style={{ margin: '0 18px 14px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '11px' }}>
              Importováno: <strong>{importResult.importedCount}</strong> · Selhalo: <strong>{importResult.failedCount}</strong>.
              {importResult.errors.map((item) => <div key={item.rowNumber} style={{ color: '#8b4444', marginTop: '4px' }}>Řádek {item.rowNumber}: {item.message}</div>)}
            </div>
          )}

          <div className="transactions-table-scroll" style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
            <table className="financial-table" style={{ minWidth: '1050px', width: '100%' }}>
              <thead><tr>
                <th className="cell-number">Řádek</th><th className="cell-date">Datum</th><th className="cell-text">Typ</th>
                <th className="cell-text">Instrument</th><th className="cell-number">Množství</th><th className="cell-number">Částka CZK</th>
                <th className="cell-text">Měna</th><th className="cell-text">Stav</th><th className="cell-text">Poznámka kontroly</th>
              </tr></thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="cell-number">{row.rowNumber}</td><td className="cell-date">{row.transactionDate || '—'}</td>
                    <td className="cell-text">{row.eventType ?? row.sourceType}</td>
                    <td className="cell-text"><span className="instrument-name">{row.instrumentName ?? row.positionName ?? '—'}</span>{row.positionId && <div style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{row.positionId}</div>}</td>
                    <td className="cell-number">{row.quantity?.toLocaleString('cs-CZ', { maximumFractionDigits: 6 }) ?? '—'}</td>
                    <td className="cell-number">{formatMoney(row.amountCzk)}</td><td className="cell-text">{row.currency}</td>
                    <td className="cell-text"><strong style={{ color: statusColor(row.status) }}>{statusLabel(row.status)}</strong></td>
                    <td className="cell-text" style={{ maxWidth: '340px' }}>{[...row.errors, ...row.warnings].join(' ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function Summary({ label, value, color }: { label: string; value: number; color?: string }) {
  return <div><div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600 }}>{label}</div><div style={{ marginTop: '2px', color, fontSize: '18px', fontWeight: 700 }}>{value.toLocaleString('cs-CZ')}</div></div>
}
