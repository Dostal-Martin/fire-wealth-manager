import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  getPortfolioPositions,
  type PortfolioPosition,
} from '../services/portfolio'

import InstrumentDetail from './InstrumentDetail'

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toLocaleString('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

function formatWeight(value: number) {
  return `${value.toLocaleString('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

function formatQuantity(value: number) {
  return value.toLocaleString('cs-CZ', {
    maximumFractionDigits: 6,
  })
}

export default function Portfolio() {
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [selectedPosition, setSelectedPosition] = useState<PortfolioPosition | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setErrorMessage('')
        const data = await getPortfolioPositions()
        if (!cancelled) setPositions(data)
      } catch (error) {
        console.error('Portfolio:', error)
        if (!cancelled) setErrorMessage('Portfolio se nepodařilo načíst.')
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

  const filteredPositions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('cs')
    if (!query) return positions

    return positions.filter((position) => {
      const instrument = position.instruments
      return [
        instrument?.name ?? '',
        instrument?.ticker ?? '',
        instrument?.asset_type ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('cs')
        .includes(query)
    })
  }, [positions, search])

  const sortedPositions = useMemo(
    () => [...filteredPositions].sort((a, b) => b.current_value - a.current_value),
    [filteredPositions],
  )

  if (loading) {
    return <div className="page"><div className="loading-box">Načítám portfolio...</div></div>
  }

  if (errorMessage) {
    return <div className="page"><div className="error-box">{errorMessage}</div></div>
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Portfolio</h1>
          <p className="page-subtitle">
            Investiční pozice a hotovost. Hotovost vstupuje do celkové hodnoty majetku, ale ne do výnosu investičních pozic.
          </p>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'right', lineHeight: 1.6 }}>
          {positions.length.toLocaleString('cs-CZ')} pozic
        </div>
      </header>

      <section className="kpi-grid">
        <MetricCard label="Celková hodnota" value={formatMoney(totals.totalValue)} />
        <MetricCard label="Hotovost" value={formatMoney(totals.cash)} />
        <MetricCard label="Investiční pozice" value={formatMoney(totals.investmentValue)} />
        <MetricCard label="Nákladová báze investic" value={formatMoney(totals.investmentCost)} />
        <MetricCard
          label="Nerealizovaný výsledek investic"
          value={formatMoney(totals.investmentProfit)}
          tone={totals.investmentProfit > 0 ? 'positive' : totals.investmentProfit < 0 ? 'negative' : 'default'}
        />
        <MetricCard
          label="Výnos investičních pozic"
          value={formatPercent(totals.investmentReturnPercent)}
          tone={totals.investmentReturnPercent > 0 ? 'positive' : totals.investmentReturnPercent < 0 ? 'negative' : 'default'}
        />
      </section>

      {selectedPosition && !selectedPosition.is_cash && (
        <div style={{ marginBottom: '20px' }}>
          <InstrumentDetail
            position={selectedPosition}
            onClose={() => setSelectedPosition(null)}
          />
        </div>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Pozice</h2>
            <div className="panel-subtitle">Investice a systémová hotovostní pozice CASH.CZK</div>
          </div>
          <div style={{ width: '260px', maxWidth: '100%' }}>
            <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hledat instrument..." />
          </div>
        </div>

        {sortedPositions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="financial-table">
              <thead>
                <tr>
                  <th className="cell-text">Instrument</th>
                  <th className="cell-text">Ticker</th>
                  <th className="cell-text">Typ</th>
                  <th className="cell-number">Počet</th>
                  <th className="cell-number">Podíl</th>
                  <th className="cell-number">Náklady</th>
                  <th className="cell-number">Hodnota</th>
                  <th className="cell-number">Výsledek</th>
                  <th className="cell-number">Výnos</th>
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map((position) => {
                  const cost = position.total_cost
                  const value = position.current_value
                  const profit = position.is_cash ? 0 : value - cost
                  const returnPercent = !position.is_cash && cost > 0 ? (profit / cost) * 100 : 0
                  const weight = totals.totalValue > 0 ? (value / totals.totalValue) * 100 : 0
                  const resultClass = profit > 0 ? 'cell-positive' : profit < 0 ? 'cell-negative' : ''

                  return (
                    <tr key={position.id}>
                      <td className="cell-text">
                        {position.is_cash ? (
                          <span className="instrument-name">{position.instruments?.name ?? 'Hotovost CZK'}</span>
                        ) : (
                          <button className="text-link" onClick={() => setSelectedPosition(position)}>
                            <span className="instrument-name">{position.instruments?.name ?? 'Neznámý instrument'}</span>
                          </button>
                        )}
                      </td>
                      <td className="cell-text"><span className="cell-muted">{position.instruments?.ticker ?? '—'}</span></td>
                      <td className="cell-text"><span className="cell-muted">{position.instruments?.asset_type ?? '—'}</span></td>
                      <td className="cell-number">{formatQuantity(position.quantity)}</td>
                      <td className="cell-number">{formatWeight(weight)}</td>
                      <td className="cell-number">{position.is_cash ? '—' : formatMoney(cost)}</td>
                      <td className="cell-number"><strong>{formatMoney(value)}</strong></td>
                      <td className={`cell-number ${resultClass}`}>{position.is_cash ? '—' : formatMoney(profit)}</td>
                      <td className={`cell-number ${resultClass}`}>{position.is_cash ? '—' : formatPercent(returnPercent)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#fafbfc', borderTop: '1px solid var(--border)' }}>
                  <td colSpan={4} style={{ padding: '13px 14px', fontWeight: 600 }}>Celkem</td>
                  <td className="cell-number">100,0 %</td>
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
            {search ? 'Vyhledávání neodpovídá žádné pozici.' : 'Portfolio neobsahuje žádné pozice.'}
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
