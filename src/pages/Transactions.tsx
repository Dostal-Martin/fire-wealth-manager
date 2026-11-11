import { useEffect, useMemo, useState } from 'react'

import {
  getTransactionLedgerOverview,
  type TransactionLedgerInstrument,
  type TransactionLedgerOverview,
} from '../services/transactionLedger'
import ManualTransactionForm from '../components/ManualTransactionForm'

type StatusFilter = 'ALL' | 'MATCH' | 'MISMATCH' | 'NO_POSITION'

type Tone = 'default' | 'positive' | 'negative' | 'warning'

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactMoney(value: number) {
  const absolute = Math.abs(value)

  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('cs-CZ', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} mil. Kč`
  }

  if (absolute >= 1_000) {
    return `${(value / 1_000).toLocaleString('cs-CZ', {
      maximumFractionDigits: 0,
    })} tis. Kč`
  }

  return formatMoney(value)
}

function formatNumber(value: number, maximumFractionDigits = 4) {
  return value.toLocaleString('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  const prefix = value > 0 ? '+' : ''

  return `${prefix}${value.toLocaleString('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('cs-CZ')
}

function transactionTypeLabel(value: 'BUY' | 'SELL') {
  return value === 'BUY' ? 'Nákup' : 'Prodej'
}

function statusLabel(status: TransactionLedgerInstrument['reconciliationStatus']) {
  if (status === 'MATCH') return 'Shoda'
  if (status === 'MISMATCH') return 'Neshoda'
  if (status === 'NO_POSITION') return 'Bez pozice'
  return 'Bez transakcí'
}

function statusStyle(status: TransactionLedgerInstrument['reconciliationStatus']) {
  if (status === 'MATCH') {
    return { color: '#416653', background: '#edf5f0', border: '#d5e7dc' }
  }

  if (status === 'MISMATCH') {
    return { color: '#8b4444', background: 'var(--danger-soft)', border: '#ead8d8' }
  }

  return { color: '#84611f', background: '#fff7df', border: '#ead9a4' }
}

export default function Transactions() {
  const [overview, setOverview] = useState<TransactionLedgerOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [expandedInstrumentId, setExpandedInstrumentId] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setErrorMessage('')
        const result = await getTransactionLedgerOverview()
        if (!cancelled) setOverview(result)
      } catch (error) {
        console.error('Transakční deník:', error)
        if (!cancelled) setErrorMessage('Transakční deník se nepodařilo načíst.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [refreshVersion])

  const filteredInstruments = useMemo(() => {
    if (!overview) return []
    const query = search.trim().toLocaleLowerCase('cs')

    return overview.instruments.filter((instrument) => {
      if (statusFilter !== 'ALL' && instrument.reconciliationStatus !== statusFilter) return false
      if (!query) return true

      return `${instrument.instrumentName} ${instrument.ticker ?? ''}`
        .toLocaleLowerCase('cs')
        .includes(query)
    })
  }, [overview, search, statusFilter])

  if (loading) {
    return <div className="page"><div className="loading-box">Načítám transakční deník...</div></div>
  }

  if (errorMessage || !overview) {
    return <div className="page"><div className="error-box">{errorMessage || 'Transakční deník není dostupný.'}</div></div>
  }

  const reconciliationIssueCount = overview.mismatchCount + overview.noPositionCount

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Transakce</h1>
          <p className="page-subtitle">
            Nákupy, prodeje, dividendy, kupóny, nákladová báze a celkový investiční výsledek.
          </p>
        </div>
      </header>

      <ManualTransactionForm onSaved={() => setRefreshVersion((value) => value + 1)} />

      <section className="kpi-grid">
        <MetricCard label="Transakce" value={overview.transactionCount.toLocaleString('cs-CZ')} description="Nákupy a prodeje" />
        <MetricCard label="Shoda pozic" value={overview.matchedCount.toLocaleString('cs-CZ')} description="Množství odpovídá" tone="positive" />
        <MetricCard label="Nákladová báze" value={formatCompactMoney(overview.remainingCostBasisCzk)} description={formatMoney(overview.remainingCostBasisCzk)} />
        <MetricCard label="Aktuální hodnota" value={formatCompactMoney(overview.currentValueCzk)} description={formatMoney(overview.currentValueCzk)} />
        <MetricCard label="Dividendy" value={formatCompactMoney(overview.dividendIncomeCzk)} description={formatMoney(overview.dividendIncomeCzk)} tone="positive" />
        <MetricCard label="Kupóny" value={formatCompactMoney(overview.couponIncomeCzk)} description={formatMoney(overview.couponIncomeCzk)} tone="positive" />
        <MetricCard label="Investiční příjmy" value={formatCompactMoney(overview.investmentIncomeCzk)} description="Dividendy a kupóny" tone="positive" />
        <MetricCard
          label="Celkový investiční výsledek"
          value={formatCompactMoney(overview.totalProfitLossCzk)}
          description={formatMoney(overview.totalProfitLossCzk)}
          tone={overview.totalProfitLossCzk > 0 ? 'positive' : overview.totalProfitLossCzk < 0 ? 'negative' : 'default'}
        />
        <MetricCard label="Nerealizovaný výsledek" value={formatCompactMoney(overview.unrealizedProfitLossCzk)} description={formatMoney(overview.unrealizedProfitLossCzk)} tone={overview.unrealizedProfitLossCzk > 0 ? 'positive' : overview.unrealizedProfitLossCzk < 0 ? 'negative' : 'default'} />
        <MetricCard label="Realizovaný výsledek" value={formatCompactMoney(overview.realizedProfitLossCzk)} description={formatMoney(overview.realizedProfitLossCzk)} tone={overview.realizedProfitLossCzk > 0 ? 'positive' : overview.realizedProfitLossCzk < 0 ? 'negative' : 'default'} />
        <MetricCard label="Neshody" value={reconciliationIssueCount.toLocaleString('cs-CZ')} description="Vyžadují kontrolu" tone={reconciliationIssueCount > 0 ? 'warning' : 'positive'} />
        <MetricCard label="Neplatné transakce" value={overview.invalidTransactionCount.toLocaleString('cs-CZ')} description="Nezapočítané do výpočtu" tone={overview.invalidTransactionCount > 0 ? 'negative' : 'positive'} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Výsledek podle instrumentů</h2>
            <div className="panel-subtitle">
              Obchodní výsledek, dividendy, kupóny a kontrola množství proti evidovaným pozicím
            </div>
          </div>
        </div>

        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(170px, 230px)', gap: '12px', alignItems: 'end' }}>
            <div>
              <label className="form-label">Hledat instrument</label>
              <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Název nebo ticker" />
            </div>
            <div>
              <label className="form-label">Stav kontroly</label>
              <select className="form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="ALL">Všechny</option>
                <option value="MATCH">Shoda</option>
                <option value="MISMATCH">Neshoda</option>
                <option value="NO_POSITION">Bez pozice</option>
              </select>
            </div>
          </div>
        </div>

        <div className="transactions-table-scroll" style={{ overflowX: 'auto' }}>
          <table className="financial-table" style={{ width: '100%', minWidth: '1180px' }}>
            <thead>
              <tr>
                <th className="cell-text" style={{ minWidth: '180px' }}>Instrument</th>
                <th className="cell-number">Z transakcí</th>
                <th className="cell-number">V pozici</th>
                <th className="cell-number">Nákladová báze</th>
                <th className="cell-number">Aktuální hodnota</th>
                <th className="cell-number">Nerealizováno</th>
                <th className="cell-number">Realizováno</th>
                <th className="cell-number">Příjmy</th>
                <th className="cell-number">Celkem</th>
                <th className="cell-text">Stav</th>
                <th className="cell-text">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filteredInstruments.map((instrument) => (
                <InstrumentRows
                  key={instrument.instrumentId}
                  instrument={instrument}
                  expanded={expandedInstrumentId === instrument.instrumentId}
                  onToggle={() => setExpandedInstrumentId((current) => current === instrument.instrumentId ? null : instrument.instrumentId)}
                />
              ))}
              {filteredInstruments.length === 0 && (
                <tr><td colSpan={11} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)' }}>Filtru neodpovídá žádný instrument.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div style={{ marginTop: '14px', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.5 }}>
        Celkový investiční výsledek zahrnuje realizovaný výsledek, nerealizovaný výsledek, dividendy a kupóny. Nejde o XIRR ani TWR.
      </div>
    </div>
  )
}

function InstrumentRows({ instrument, expanded, onToggle }: { instrument: TransactionLedgerInstrument; expanded: boolean; onToggle: () => void }) {
  const status = statusStyle(instrument.reconciliationStatus)

  return (
    <>
      <tr>
        <td className="cell-text">
          <span className="instrument-name">{instrument.instrumentName}</span>
          {instrument.ticker && <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '10px' }}>{instrument.ticker}</div>}
        </td>
        <td className="cell-number">{formatNumber(instrument.ledgerQuantity, 4)}</td>
        <td className="cell-number">{instrument.positionQuantity !== null ? formatNumber(instrument.positionQuantity, 4) : '—'}</td>
        <td className="cell-number">{formatCompactMoney(instrument.remainingCostBasisCzk)}</td>
        <td className="cell-number">{formatCompactMoney(instrument.currentValueCzk)}</td>
        <td className="cell-number"><ResultValue value={instrument.unrealizedProfitLossCzk} detail={formatPercent(instrument.unrealizedReturnPercent)} /></td>
        <td className="cell-number"><ResultValue value={instrument.realizedProfitLossCzk} /></td>
        <td className="cell-number"><ResultValue value={instrument.investmentIncomeCzk} /></td>
        <td className="cell-number"><ResultValue value={instrument.totalProfitLossCzk} detail={formatPercent(instrument.totalReturnPercent)} /></td>
        <td className="cell-text">
          <span style={{ display: 'inline-flex', padding: '4px 7px', borderRadius: '999px', color: status.color, background: status.background, border: `1px solid ${status.border}`, fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {statusLabel(instrument.reconciliationStatus)}
          </span>
        </td>
        <td className="cell-text">
          <button className="button-secondary" onClick={onToggle} style={{ padding: '5px 8px', fontSize: '10px' }}>{expanded ? 'Skrýt' : 'Detail'}</button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={11} style={{ padding: 0, background: '#fafbfc' }}>
            <TransactionDetail instrument={instrument} />
          </td>
        </tr>
      )}
    </>
  )
}

function TransactionDetail({ instrument }: { instrument: TransactionLedgerInstrument }) {
  return (
    <div style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <DetailMetric label="Nakoupeno" value={formatNumber(instrument.buyQuantity, 6)} />
        <DetailMetric label="Prodáno" value={formatNumber(instrument.sellQuantity, 6)} />
        <DetailMetric label="Nákladová báze" value={formatMoney(instrument.remainingCostBasisCzk)} />
        <DetailMetric label="Nerealizováno" value={formatMoney(instrument.unrealizedProfitLossCzk)} />
        <DetailMetric label="Realizováno" value={formatMoney(instrument.realizedProfitLossCzk)} />
        <DetailMetric label="Dividendy" value={formatMoney(instrument.dividendIncomeCzk)} />
        <DetailMetric label="Kupóny" value={formatMoney(instrument.couponIncomeCzk)} />
        <DetailMetric label="Příjmy celkem" value={formatMoney(instrument.investmentIncomeCzk)} />
        <DetailMetric label="Celkový výsledek" value={formatMoney(instrument.totalProfitLossCzk)} />
      </div>

      {instrument.issues.length > 0 && (
        <div style={{ marginBottom: '14px', padding: '10px 12px', color: '#8b4444', background: 'var(--danger-soft)', border: '1px solid #ead8d8', borderRadius: '5px', fontSize: '11px' }}>
          {instrument.issues.map((issue) => <div key={`${issue.transactionId}-${issue.code}`}>{formatDate(issue.transactionDate)}: {issue.message}</div>)}
        </div>
      )}

      <div className="transactions-detail-scroll" style={{ overflowX: 'auto' }}>
        <table className="financial-table" style={{ minWidth: '860px', width: '100%' }}>
          <thead>
            <tr>
              <th className="cell-date">Datum</th>
              <th className="cell-text">Typ</th>
              <th className="cell-number">Množství</th>
              <th className="cell-number">Částka</th>
              <th className="cell-number">Množství po</th>
              <th className="cell-number">Průměrná cena po</th>
              <th className="cell-number">Nákladová báze po</th>
              <th className="cell-number">Realizovaný výsledek</th>
            </tr>
          </thead>
          <tbody>
            {instrument.transactions.map((transaction) => (
              <tr key={transaction.id} style={transaction.valid ? undefined : { opacity: 0.55 }}>
                <td className="cell-date">{formatDate(transaction.transactionDate)}</td>
                <td className="cell-text">{transactionTypeLabel(transaction.transactionType)}</td>
                <td className="cell-number">{formatNumber(transaction.quantity, 6)}</td>
                <td className="cell-number">{formatMoney(transaction.amountCzk)}</td>
                <td className="cell-number">{formatNumber(transaction.quantityAfter, 6)}</td>
                <td className="cell-number">{formatMoney(transaction.averageCostAfter)}</td>
                <td className="cell-number">{formatMoney(transaction.costBasisAfter)}</td>
                <td className="cell-number">{transaction.realizedProfitLoss !== null ? formatMoney(transaction.realizedProfitLoss) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResultValue({ value, detail }: { value: number; detail?: string }) {
  return (
    <div>
      <div className={value > 0 ? 'positive' : value < 0 ? 'negative' : ''} style={{ fontWeight: 600 }}>{formatCompactMoney(value)}</div>
      {detail && detail !== '—' && <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '9px' }}>{detail}</div>}
    </div>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: '3px', fontSize: '12px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function MetricCard({ label, value, description, tone = 'default' }: { label: string; value: string; description?: string; tone?: Tone }) {
  const className = tone === 'positive' ? 'positive' : tone === 'negative' ? 'negative' : ''
  const style = tone === 'warning' ? { color: '#84611f' } : undefined

  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${className}`} style={style}>{value}</div>
      {description && <div className="kpi-description">{description}</div>}
    </div>
  )
}
