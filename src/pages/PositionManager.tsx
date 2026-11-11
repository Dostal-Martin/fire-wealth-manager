import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  getPortfolioPositions,
  type PortfolioPosition,
} from '../services/portfolio'

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return value.toLocaleString('cs-CZ', {
    maximumFractionDigits: 6,
  })
}

function formatPercent(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toLocaleString('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

export default function PositionManager() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setErrorMessage('')
        const data = await getPortfolioPositions()
        if (!cancelled) setPositions(data)
      } catch (error) {
        console.error('Position manager:', error)
        if (!cancelled) setErrorMessage('Pozice se nepodařilo načíst.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  const totals = useMemo(() => {
    const cash = positions
      .filter((position) => position.is_cash)
      .reduce((sum, position) => sum + position.current_value, 0)

    const investments = positions.filter((position) => !position.is_cash)
    const investmentValue = investments.reduce((sum, position) => sum + position.current_value, 0)
    const investmentCost = investments.reduce((sum, position) => sum + position.total_cost, 0)
    const investmentProfit = investmentValue - investmentCost
    const investmentReturnPercent = investmentCost > 0
      ? (investmentProfit / investmentCost) * 100
      : 0

    return {
      cash,
      investmentValue,
      totalValue: cash + investmentValue,
      investmentCost,
      investmentProfit,
      investmentReturnPercent,
    }
  }, [positions])

  const visiblePositions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('cs')
    const filtered = query
      ? positions.filter((position) => [
          position.instruments?.name ?? '',
          position.instruments?.ticker ?? '',
          position.instruments?.asset_type ?? '',
        ].join(' ').toLocaleLowerCase('cs').includes(query))
      : positions

    return [...filtered].sort((a, b) => b.current_value - a.current_value)
  }, [positions, search])

  if (loading) {
    return <div className="page"><div className="loading-box">Načítám pozice...</div></div>
  }

  if (errorMessage) {
    return <div className="page"><div className="error-box">{errorMessage}</div></div>
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Správa pozic</h1>
          <p className="page-subtitle">
            Kontrolní přehled pouze pro čtení. Investiční pozice vznikají a mění se přes BUY/SELL, hotovost přes cashflow.
          </p>
        </div>
        <div className="position-header-meta">
          {positions.length.toLocaleString('cs-CZ')} pozic
        </div>
      </header>

      <section className="kpi-grid">
        <MetricCard label="Celková hodnota" value={formatMoney(totals.totalValue)} />
        <MetricCard label="Hotovost" value={formatMoney(totals.cash)} />
        <MetricCard label="Investiční pozice" value={formatMoney(totals.investmentValue)} />
        <MetricCard label="Nákladová báze" value={formatMoney(totals.investmentCost)} />
        <MetricCard
          label="Nerealizovaný výsledek"
          value={formatMoney(totals.investmentProfit)}
          tone={totals.investmentProfit > 0 ? 'positive' : totals.investmentProfit < 0 ? 'negative' : 'default'}
        />
        <MetricCard
          label="Výnos investic"
          value={formatPercent(totals.investmentReturnPercent)}
          tone={totals.investmentReturnPercent > 0 ? 'positive' : totals.investmentReturnPercent < 0 ? 'negative' : 'default'}
        />
      </section>

      <div style={{ marginBottom: '18px', padding: '10px 12px', background: '#fafbfc', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.5 }}>
        Pozice zde nelze ručně přidat, upravit ani smazat. BUY pozici vytvoří nebo zvýší, SELL ji sníží. DEPOSIT, WITHDRAWAL, DIVIDEND, COUPON a INTEREST mění systémovou hotovost CASH.CZK.
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Pozice</h2>
            <div className="panel-subtitle">Odvozeno z transakčního ledgeru, cashflow a aktuálního ocenění</div>
          </div>
          <div style={{ width: '260px', maxWidth: '100%' }}>
            <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hledat instrument..." />
          </div>
        </div>

        {visiblePositions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="financial-table">
              <thead>
                <tr>
                  <th className="cell-text">Instrument</th>
                  <th className="cell-text">Ticker</th>
                  <th className="cell-text">Typ</th>
                  <th className="cell-number">Počet</th>
                  <th className="cell-number">Nákladová báze</th>
                  <th className="cell-number">Hodnota</th>
                  <th className="cell-number">Výsledek</th>
                  <th className="cell-number">Výnos</th>
                </tr>
              </thead>
              <tbody>
                {visiblePositions.map((position) => {
                  const profit = position.is_cash ? 0 : position.current_value - position.total_cost
                  const returnPercent = !position.is_cash && position.total_cost > 0
                    ? (profit / position.total_cost) * 100
                    : 0
                  const resultClass = profit > 0 ? 'cell-positive' : profit < 0 ? 'cell-negative' : ''

                  return (
                    <tr key={position.id}>
                      <td className="cell-text"><span className="instrument-name">{position.instruments?.name ?? 'Neznámý instrument'}</span></td>
                      <td className="cell-text"><span className="cell-muted">{position.instruments?.ticker ?? '—'}</span></td>
                      <td className="cell-text"><span className="cell-muted">{position.instruments?.asset_type ?? '—'}</span></td>
                      <td className="cell-number">{formatNumber(position.quantity)}</td>
                      <td className="cell-number">{position.is_cash ? '—' : formatMoney(position.total_cost)}</td>
                      <td className="cell-number"><strong>{formatMoney(position.current_value)}</strong></td>
                      <td className={`cell-number ${resultClass}`}>{position.is_cash ? '—' : formatMoney(profit)}</td>
                      <td className={`cell-number ${resultClass}`}>{position.is_cash ? '—' : formatPercent(returnPercent)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="position-total-row">
                  <td colSpan={4}>Celkem</td>
                  <td className="cell-number">{formatMoney(totals.investmentCost)}</td>
                  <td className="cell-number"><strong>{formatMoney(totals.totalValue)}</strong></td>
                  <td className={totals.investmentProfit > 0 ? 'cell-number cell-positive' : totals.investmentProfit < 0 ? 'cell-number cell-negative' : 'cell-number'}>{formatMoney(totals.investmentProfit)}</td>
                  <td className={totals.investmentReturnPercent > 0 ? 'cell-number cell-positive' : totals.investmentReturnPercent < 0 ? 'cell-number cell-negative' : 'cell-number'}>{formatPercent(totals.investmentReturnPercent)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-box" style={{ margin: '20px' }}>
            {search ? 'Vyhledávání neodpovídá žádné pozici.' : 'Nejsou evidovány žádné pozice.'}
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({ label, value, tone = 'default' }: {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative'
}) {
  const valueClass = tone === 'positive' ? 'positive' : tone === 'negative' ? 'negative' : ''
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
    </div>
  )
}
