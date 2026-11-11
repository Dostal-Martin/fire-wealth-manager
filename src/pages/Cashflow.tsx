import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import ExternalCashflowForm from '../components/ExternalCashflowForm'
import {
  deleteCashflow,
  getCashflows,
} from '../services/cashflowManager'

type CashflowRow = {
  id: string
  transaction_date: string
  transaction_type: string
  amount_czk: number | string
  is_external: boolean
  note: string | null
  instruments: { name: string } | null
}

type FilterType =
  | 'ALL'
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'COUPON'
  | 'INTEREST'
  | 'DEPOSIT'
  | 'CONTRIBUTION'
  | 'WITHDRAWAL'

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

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('cs-CZ')
}

function transactionName(type: string) {
  switch (type) {
    case 'BUY': return 'Nákup'
    case 'SELL': return 'Prodej'
    case 'DIVIDEND': return 'Dividenda'
    case 'COUPON': return 'Kupón'
    case 'INTEREST': return 'Úrok'
    case 'DEPOSIT':
    case 'CONTRIBUTION': return 'Vklad'
    case 'WITHDRAWAL': return 'Výběr'
    case 'FEE': return 'Poplatek'
    case 'TAX': return 'Daň'
    default: return type
  }
}

function transactionBadgeClass(type: string) {
  if (['DIVIDEND', 'COUPON', 'INTEREST'].includes(type)) {
    return 'cashflow-badge cashflow-badge-income'
  }

  if (type === 'DEPOSIT' || type === 'CONTRIBUTION') {
    return 'cashflow-badge cashflow-badge-contribution'
  }

  if (type === 'WITHDRAWAL') {
    return 'cashflow-badge cashflow-badge-withdrawal'
  }

  return 'cashflow-badge'
}

export default function Cashflow() {
  const [cashflows, setCashflows] = useState<CashflowRow[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<FilterType>('ALL')
  const [onlyExternal, setOnlyExternal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function load() {
    try {
      setLoading(true)
      setErrorMessage('')
      const data = await getCashflows()
      setCashflows(data as CashflowRow[])
    } catch (error) {
      console.error('Cashflow:', error)
      setErrorMessage('Cashflow se nepodařilo načíst.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleDelete(row: CashflowRow) {
    if (!row.is_external) return

    const confirmed = window.confirm(
      'Opravdu smazat tento externí pohyb? Tím se může změnit XIRR a TWR.',
    )

    if (!confirmed) return

    try {
      await deleteCashflow(row.id)
      setMessage('Externí cashflow bylo smazáno.')
      await load()
    } catch (error) {
      console.error('Cashflow delete:', error)
      setMessage('Cashflow se nepodařilo smazat.')
    }
  }

  const stats = useMemo(() => {
    let deposits = 0
    let withdrawals = 0
    let dividends = 0
    let coupons = 0
    let interest = 0

    for (const row of cashflows) {
      const value = Number(row.amount_czk)
      if (!Number.isFinite(value)) continue

      if (
        row.is_external
        && (row.transaction_type === 'DEPOSIT' || row.transaction_type === 'CONTRIBUTION')
      ) {
        deposits += Math.abs(value)
      }

      if (row.is_external && row.transaction_type === 'WITHDRAWAL') {
        withdrawals += Math.abs(value)
      }

      if (row.transaction_type === 'DIVIDEND') dividends += value
      if (row.transaction_type === 'COUPON') coupons += value
      if (row.transaction_type === 'INTEREST') interest += value
    }

    return {
      deposits,
      withdrawals,
      netExternal: deposits - withdrawals,
      dividends,
      coupons,
      interest,
      investmentIncome: dividends + coupons + interest,
    }
  }, [cashflows])

  const visibleCashflows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('cs')

    return cashflows.filter((row) => {
      if (onlyExternal && !row.is_external) return false

      if (filterType !== 'ALL') {
        const depositFilter = filterType === 'DEPOSIT'
          && (row.transaction_type === 'DEPOSIT' || row.transaction_type === 'CONTRIBUTION')

        if (!depositFilter && row.transaction_type !== filterType) return false
      }

      if (!query) return true

      return [
        row.instruments?.name ?? '',
        transactionName(row.transaction_type),
        row.note ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('cs')
        .includes(query)
    })
  }, [cashflows, onlyExternal, filterType, search])

  if (loading) {
    return (
      <div className="page">
        <div className="loading-box">Načítám cashflow...</div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="page">
        <div className="error-box">{errorMessage}</div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Cashflow</h1>
          <p className="page-subtitle">
            Externí vklady a výběry pro XIRR a TWR, dividendy, kupóny a úroky.
          </p>
        </div>

        <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'right', lineHeight: 1.6 }}>
          {cashflows.length.toLocaleString('cs-CZ')} transakcí
        </div>
      </header>

      <ExternalCashflowForm
        onSaved={() => {
          setMessage('Externí cashflow bylo uloženo.')
          void load()
        }}
      />

      <section className="kpi-grid">
        <MetricCard label="Externí vklady" value={formatCompactMoney(stats.deposits)} description={formatMoney(stats.deposits)} />
        <MetricCard label="Externí výběry" value={formatCompactMoney(stats.withdrawals)} description={formatMoney(stats.withdrawals)} />
        <MetricCard label="Čisté externí vklady" value={formatCompactMoney(stats.netExternal)} description={formatMoney(stats.netExternal)} />
        <MetricCard label="Dividendy" value={formatCompactMoney(stats.dividends)} description={formatMoney(stats.dividends)} />
        <MetricCard label="Kupóny" value={formatCompactMoney(stats.coupons)} description={formatMoney(stats.coupons)} />
        <MetricCard label="Úroky" value={formatCompactMoney(stats.interest)} description={formatMoney(stats.interest)} />
        <MetricCard label="Investiční příjmy" value={formatCompactMoney(stats.investmentIncome)} description={formatMoney(stats.investmentIncome)} />
      </section>

      <div
        style={{
          marginTop: '14px',
          marginBottom: '18px',
          padding: '10px 12px',
          background: '#fafbfc',
          border: '1px solid var(--border)',
          borderRadius: '5px',
          color: 'var(--text-secondary)',
          fontSize: '11px',
          lineHeight: 1.5,
        }}
      >
        Vklad nebo výběr zadávej pouze tehdy, když peníze překročí hranici celého majetku sledovaného ve FIRE WM.
        Převod mezi brokerem a spořicím účtem, které jsou oba evidované ve FIRE WM, není externí cashflow.
      </div>

      {message && (
        <div className="cashflow-status" style={{ marginBottom: '12px' }}>
          {message}
        </div>
      )}

      <section className="panel">
        <div className="panel-header cashflow-table-header">
          <div>
            <h2 className="panel-title">Historie</h2>
            <div className="panel-subtitle">Všechny peněžní pohyby portfolia</div>
          </div>

          <div className="cashflow-filters">
            <input
              className="form-control cashflow-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Hledat..."
            />

            <select
              className="form-control cashflow-filter-select"
              value={filterType}
              onChange={(event) => setFilterType(event.target.value as FilterType)}
            >
              <option value="ALL">Všechny typy</option>
              <option value="BUY">Nákupy</option>
              <option value="SELL">Prodeje</option>
              <option value="DIVIDEND">Dividendy</option>
              <option value="COUPON">Kupóny</option>
              <option value="INTEREST">Úroky</option>
              <option value="DEPOSIT">Vklady</option>
              <option value="WITHDRAWAL">Výběry</option>
            </select>

            <label className="cashflow-external-filter">
              <input
                type="checkbox"
                checked={onlyExternal}
                onChange={(event) => setOnlyExternal(event.target.checked)}
              />
              Jen externí
            </label>
          </div>
        </div>

        {visibleCashflows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="financial-table">
              <thead>
                <tr>
                  <th className="cell-date">Datum</th>
                  <th className="cell-text">Typ</th>
                  <th className="cell-text">Instrument</th>
                  <th className="cell-number">Částka</th>
                  <th className="cell-text">Charakter</th>
                  <th className="cell-text">Poznámka</th>
                  <th style={{ width: '52px' }} />
                </tr>
              </thead>

              <tbody>
                {visibleCashflows.map((row) => {
                  const value = Number(row.amount_czk)
                  const isIncome = ['DIVIDEND', 'COUPON', 'INTEREST'].includes(row.transaction_type)
                  const amountClass = row.transaction_type === 'WITHDRAWAL' || value < 0
                    ? 'cell-number cell-negative'
                    : isIncome
                      ? 'cell-number cell-positive'
                      : 'cell-number'

                  return (
                    <tr key={row.id}>
                      <td className="cell-date">{formatDate(row.transaction_date)}</td>
                      <td className="cell-text">
                        <span className={transactionBadgeClass(row.transaction_type)}>
                          {transactionName(row.transaction_type)}
                        </span>
                      </td>
                      <td className="cell-text">
                        <span className="instrument-name">{row.instruments?.name ?? '—'}</span>
                      </td>
                      <td className={amountClass}>{formatMoney(value)}</td>
                      <td className="cell-text">
                        {row.is_external
                          ? <span className="cashflow-external-label">Externí</span>
                          : <span className="cell-muted">Interní</span>}
                      </td>
                      <td className="cell-text">
                        <span style={{ color: 'var(--text-secondary)' }}>{row.note || '—'}</span>
                      </td>
                      <td className="cell-number">
                        {row.is_external && (
                          <button
                            className="cashflow-delete"
                            onClick={() => void handleDelete(row)}
                            title="Smazat externí cashflow"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-box" style={{ margin: '20px' }}>
            Filtru neodpovídají žádné transakce.
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {description && <div className="kpi-description">{description}</div>}
    </div>
  )
}
