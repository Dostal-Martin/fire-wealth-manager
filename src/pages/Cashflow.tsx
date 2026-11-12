import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import ExternalCashflowForm from '../components/ExternalCashflowForm'
import InternalTransferForm from '../components/InternalTransferForm'
import InvestmentIncomeForm from '../components/InvestmentIncomeForm'
import {
  deleteCashflow,
  getCashflows,
} from '../services/cashflowManager'
import {
  getInternalTransfers,
  type InternalTransferRow,
} from '../services/internalTransfer'

type CashflowRow = {
  id: string
  transaction_date: string
  transaction_type: string
  amount_czk: number | string
  is_external: boolean
  note: string | null
  instruments: { name: string } | { name: string }[] | null
}

type HistoryRow =
  | {
      kind: 'CASHFLOW'
      id: string
      date: string
      type: string
      amountCzk: number
      instrument: string
      character: 'Externí' | 'Interní'
      note: string | null
      isExternal: boolean
    }
  | {
      kind: 'TRANSFER'
      id: string
      date: string
      type: 'TRANSFER'
      amountCzk: number
      instrument: string
      character: 'Interní převod'
      note: string | null
      isExternal: false
      sourceAmount: number
      destinationAmount: number
      sourceCurrency: string
      destinationCurrency: string
      feeCzk: number
    }

type FilterType =
  | 'ALL'
  | 'DIVIDEND'
  | 'COUPON'
  | 'INTEREST'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER'

function oneRelationName(value: { name: string } | { name: string }[] | null) {
  if (!value) return '—'
  return Array.isArray(value) ? value[0]?.name ?? '—' : value.name
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatAmount(value: number, currency: string) {
  return value.toLocaleString('cs-CZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CZK' ? 0 : 2,
  })
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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('cs-CZ')
}

function transactionName(type: string) {
  switch (type) {
    case 'DIVIDEND': return 'Dividenda'
    case 'COUPON': return 'Kupón'
    case 'INTEREST': return 'Úrok'
    case 'DEPOSIT':
    case 'CONTRIBUTION': return 'Vklad'
    case 'WITHDRAWAL': return 'Výběr'
    case 'TRANSFER': return 'Interní převod'
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
  const [transfers, setTransfers] = useState<InternalTransferRow[]>([])
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
      const [cashflowData, transferData] = await Promise.all([
        getCashflows(),
        getInternalTransfers(),
      ])
      setCashflows(cashflowData as CashflowRow[])
      setTransfers(transferData)
    } catch (error) {
      console.error('Cashflow:', error)
      setErrorMessage('Cashflow a interní převody se nepodařilo načíst.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function refresh(messageText: string) {
    setMessage(messageText)
    void load()
  }

  async function handleDelete(row: HistoryRow) {
    if (row.kind !== 'CASHFLOW' || !row.isExternal) return

    const confirmed = window.confirm(
      'Externí vklad nebo výběr neopravuj smazáním. Použij opačný opravný pohyb. Pokračovat v pokusu o smazání?',
    )
    if (!confirmed) return

    try {
      await deleteCashflow(row.id)
      setMessage('Cashflow bylo smazáno.')
      await load()
    } catch (error) {
      console.error('Cashflow delete:', error)
      setMessage(error instanceof Error ? error.message : 'Cashflow se nepodařilo smazat.')
    }
  }

  const stats = useMemo(() => {
    let deposits = 0
    let withdrawals = 0
    let dividends = 0
    let coupons = 0
    let interest = 0
    let fees = 0

    for (const row of cashflows) {
      const value = Number(row.amount_czk)
      if (!Number.isFinite(value)) continue

      if (row.is_external && ['DEPOSIT', 'CONTRIBUTION'].includes(row.transaction_type)) deposits += Math.abs(value)
      if (row.is_external && row.transaction_type === 'WITHDRAWAL') withdrawals += Math.abs(value)
      if (row.transaction_type === 'DIVIDEND') dividends += value
      if (row.transaction_type === 'COUPON') coupons += value
      if (row.transaction_type === 'INTEREST') interest += value
    }

    for (const transfer of transfers) {
      const fee = Number(transfer.fee_czk)
      if (Number.isFinite(fee)) fees += fee
    }

    return {
      deposits,
      withdrawals,
      netExternal: deposits - withdrawals,
      dividends,
      coupons,
      interest,
      investmentIncome: dividends + coupons + interest,
      transferCount: transfers.length,
      transferFees: fees,
    }
  }, [cashflows, transfers])

  const history = useMemo<HistoryRow[]>(() => {
    const cashflowRows: HistoryRow[] = cashflows.map((row) => ({
      kind: 'CASHFLOW',
      id: row.id,
      date: row.transaction_date,
      type: row.transaction_type === 'CONTRIBUTION' ? 'DEPOSIT' : row.transaction_type,
      amountCzk: Number(row.amount_czk),
      instrument: oneRelationName(row.instruments),
      character: row.is_external ? 'Externí' : 'Interní',
      note: row.note,
      isExternal: row.is_external,
    }))

    const transferRows: HistoryRow[] = transfers.map((row) => ({
      kind: 'TRANSFER',
      id: row.id,
      date: row.transfer_date,
      type: 'TRANSFER',
      amountCzk: Number(row.destination_value_czk),
      instrument: `${oneRelationName(row.source_instrument)} → ${oneRelationName(row.destination_instrument)}`,
      character: 'Interní převod',
      note: row.note,
      isExternal: false,
      sourceAmount: Number(row.source_amount),
      destinationAmount: Number(row.destination_amount),
      sourceCurrency: row.source_currency,
      destinationCurrency: row.destination_currency,
      feeCzk: Number(row.fee_czk),
    }))

    return [...cashflowRows, ...transferRows]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [cashflows, transfers])

  const visibleHistory = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('cs')

    return history.filter((row) => {
      if (onlyExternal && !row.isExternal) return false
      if (filterType !== 'ALL' && row.type !== filterType) return false
      if (!query) return true

      return [row.instrument, transactionName(row.type), row.note ?? '']
        .join(' ')
        .toLocaleLowerCase('cs')
        .includes(query)
    })
  }, [history, onlyExternal, filterType, search])

  if (loading) {
    return <div className="page"><div className="loading-box">Načítám cashflow...</div></div>
  }

  if (errorMessage) {
    return <div className="page"><div className="error-box">{errorMessage}</div></div>
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Cashflow</h1>
          <p className="page-subtitle">
            Externí kapitál, interní převody mezi účty a investiční příjmy. Každý typ pohybu má odlišný dopad na majetek a výkonnost.
          </p>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'right', lineHeight: 1.6 }}>
          {history.length.toLocaleString('cs-CZ')} pohybů
        </div>
      </header>

      <ExternalCashflowForm onSaved={() => refresh('Externí cashflow bylo uloženo a zůstatek aktualizován.')} />
      <InternalTransferForm onSaved={() => refresh('Interní převod byl uložen. Celkové čisté jmění se nezměnilo, kromě případného poplatku.')} />
      <InvestmentIncomeForm onSaved={() => refresh('Investiční příjem byl uložen a zůstatek aktualizován.')} />

      <section className="kpi-grid">
        <MetricCard label="Externí vklady" value={formatCompactMoney(stats.deposits)} description={formatMoney(stats.deposits)} />
        <MetricCard label="Externí výběry" value={formatCompactMoney(stats.withdrawals)} description={formatMoney(stats.withdrawals)} />
        <MetricCard label="Čisté externí vklady" value={formatCompactMoney(stats.netExternal)} description={formatMoney(stats.netExternal)} />
        <MetricCard label="Interní převody" value={stats.transferCount.toLocaleString('cs-CZ')} description={`Poplatky ${formatMoney(stats.transferFees)}`} />
        <MetricCard label="Dividendy" value={formatCompactMoney(stats.dividends)} description={formatMoney(stats.dividends)} />
        <MetricCard label="Kupóny" value={formatCompactMoney(stats.coupons)} description={formatMoney(stats.coupons)} />
        <MetricCard label="Úroky" value={formatCompactMoney(stats.interest)} description={formatMoney(stats.interest)} />
        <MetricCard label="Investiční příjmy" value={formatCompactMoney(stats.investmentIncome)} description={formatMoney(stats.investmentIncome)} />
      </section>

      <div style={{ marginTop: '14px', marginBottom: '18px', padding: '10px 12px', background: '#fafbfc', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5 }}>
        <strong>Vklad/výběr</strong> překračuje hranici celého FIRE WM a vstupuje do XIRR/TWR. <strong>Interní převod</strong> pouze přesouvá hodnotu mezi sledovanými účty a čisté jmění nemění, kromě poplatku. <strong>Dividenda, kupón a úrok</strong> jsou investičním příjmem a zvyšují Total Return.
      </div>

      {message && <div className="cashflow-status" style={{ marginBottom: '12px' }}>{message}</div>}

      <section className="panel">
        <div className="panel-header cashflow-table-header">
          <div>
            <h2 className="panel-title">Historie</h2>
            <div className="panel-subtitle">Externí cashflow, interní převody a investiční příjmy v jedné časové ose</div>
          </div>

          <div className="cashflow-filters">
            <input className="form-control cashflow-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hledat..." />
            <select className="form-control cashflow-filter-select" value={filterType} onChange={(event) => setFilterType(event.target.value as FilterType)}>
              <option value="ALL">Všechny typy</option>
              <option value="DEPOSIT">Vklady</option>
              <option value="WITHDRAWAL">Výběry</option>
              <option value="TRANSFER">Interní převody</option>
              <option value="DIVIDEND">Dividendy</option>
              <option value="COUPON">Kupóny</option>
              <option value="INTEREST">Úroky</option>
            </select>
            <label className="cashflow-external-filter">
              <input type="checkbox" checked={onlyExternal} onChange={(event) => setOnlyExternal(event.target.checked)} />
              Jen externí
            </label>
          </div>
        </div>

        {visibleHistory.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="financial-table">
              <thead>
                <tr>
                  <th className="cell-date">Datum</th>
                  <th className="cell-text">Typ</th>
                  <th className="cell-text">Účet / instrument</th>
                  <th className="cell-number">Částka / hodnota</th>
                  <th className="cell-text">Charakter</th>
                  <th className="cell-text">Poznámka</th>
                  <th style={{ width: '52px' }} />
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((row) => {
                  const isIncome = ['DIVIDEND', 'COUPON', 'INTEREST'].includes(row.type)
                  const amountClass = row.type === 'WITHDRAWAL' || row.amountCzk < 0
                    ? 'cell-number cell-negative'
                    : isIncome
                      ? 'cell-number cell-positive'
                      : 'cell-number'

                  return (
                    <tr key={`${row.kind}-${row.id}`}>
                      <td className="cell-date">{formatDate(row.date)}</td>
                      <td className="cell-text">
                        <span className={transactionBadgeClass(row.type)}>{transactionName(row.type)}</span>
                      </td>
                      <td className="cell-text">
                        <span className="instrument-name">{row.instrument}</span>
                        {row.kind === 'TRANSFER' && row.sourceCurrency !== row.destinationCurrency && (
                          <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '9px' }}>
                            {formatAmount(row.sourceAmount, row.sourceCurrency)} → {formatAmount(row.destinationAmount, row.destinationCurrency)}
                          </div>
                        )}
                      </td>
                      <td className={amountClass}>
                        {formatMoney(row.amountCzk)}
                        {row.kind === 'TRANSFER' && row.feeCzk > 0 && (
                          <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '9px' }}>Poplatek {formatMoney(row.feeCzk)}</div>
                        )}
                      </td>
                      <td className="cell-text">
                        {row.isExternal
                          ? <span className="cashflow-external-label">Externí</span>
                          : <span className="cell-muted">{row.character}</span>}
                      </td>
                      <td className="cell-text"><span style={{ color: 'var(--text-secondary)' }}>{row.note || '—'}</span></td>
                      <td className="cell-number">
                        {row.kind === 'CASHFLOW' && row.isExternal && (
                          <button className="cashflow-delete" onClick={() => void handleDelete(row)} title="Externí pohyb neopravuj mazáním">×</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-box" style={{ margin: '20px' }}>Filtru neodpovídají žádné pohyby.</div>
        )}
      </section>
    </div>
  )
}

function MetricCard({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {description && <div className="kpi-description">{description}</div>}
    </div>
  )
}
