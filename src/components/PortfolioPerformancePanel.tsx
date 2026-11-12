import { useEffect, useMemo, useState } from 'react'
import type { PerformancePeriod, PerformanceQuality } from '../domain/performanceHistory'
import {
  getPortfolioPeriodPerformance,
  type PortfolioPeriodPerformance,
} from '../services/portfolioPerformance'

const PERIODS: Array<{ value: PerformancePeriod; label: string }> = [
  { value: 'YTD', label: 'YTD' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1R' },
  { value: '3Y', label: '3R' },
  { value: '5Y', label: '5R' },
  { value: 'MAX', label: 'MAX' },
]

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'N/A'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toLocaleString('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} %`
}

function qualityLabel(quality: PerformanceQuality) {
  if (quality === 'FULL') return 'Úplná data'
  if (quality === 'PARTIAL') return 'Částečná data'
  return 'Nedostupná data'
}

function qualityColor(quality: PerformanceQuality) {
  if (quality === 'FULL') return '#416653'
  if (quality === 'PARTIAL') return '#84611f'
  return '#8b4444'
}

export default function PortfolioPerformancePanel() {
  const [period, setPeriod] = useState<PerformancePeriod>('YTD')
  const [data, setData] = useState<PortfolioPeriodPerformance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError('')
        const result = await getPortfolioPeriodPerformance(period)
        if (!cancelled) setData(result)
      } catch (reason) {
        console.error('Periodická výkonnost:', reason)
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Periodickou výkonnost se nepodařilo načíst.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [period])

  const visibleInstruments = useMemo(
    () => data?.instruments.filter((instrument) => instrument.quality !== 'UNAVAILABLE' || instrument.investmentIncomeCzk !== 0) ?? [],
    [data],
  )

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Historická výkonnost investic</h2>
          <div className="panel-subtitle">
            Total Return v CZK z historických cen, FX, nákupů, prodejů a evidovaných investičních příjmů.
          </div>
        </div>
      </div>

      <div className="panel-body">
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={item.value === period ? 'button-primary' : 'button-secondary'}
              onClick={() => setPeriod(item.value)}
              style={{ padding: '6px 10px', minWidth: '48px' }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading && <div className="loading-box" style={{ marginTop: '16px' }}>Počítám výkonnost...</div>}
        {error && <div className="error-box" style={{ marginTop: '16px' }}>{error}</div>}

        {!loading && !error && data && (
          <>
            <div className="kpi-grid" style={{ marginTop: '18px' }}>
              <Metric label="Total Return" value={formatPercent(data.returnPercent)} tone={data.profitCzk > 0 ? 'positive' : data.profitCzk < 0 ? 'negative' : 'default'} />
              <Metric label="Výsledek" value={formatMoney(data.profitCzk)} tone={data.profitCzk > 0 ? 'positive' : data.profitCzk < 0 ? 'negative' : 'default'} />
              <Metric label="Počáteční hodnota" value={formatMoney(data.startMarketValueCzk)} />
              <Metric label="Koncová hodnota" value={formatMoney(data.endMarketValueCzk)} />
              <Metric label="Nákupy" value={formatMoney(data.buyCashCzk)} />
              <Metric label="Prodeje" value={formatMoney(data.sellCashCzk)} />
              <Metric label="Dividendy" value={formatMoney(data.dividendIncomeCzk)} tone="positive" />
              <Metric label="Kupóny" value={formatMoney(data.couponIncomeCzk)} tone="positive" />
              <Metric label="Evidované úroky" value={formatMoney(data.interestIncomeCzk)} tone="positive" />
            </div>

            <div style={{ marginTop: '14px', padding: '10px 12px', background: '#fafbfc', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '11px', lineHeight: 1.5 }}>
              <strong style={{ color: qualityColor(data.quality) }}>{qualityLabel(data.quality)}</strong>
              {' · '}{data.unavailableInstrumentCount} instrumentů bez dostatečné historie, {data.partialInstrumentCount} s částečnou historií.
              {' '}Výsledek nezahrnuje neznámé historické úroky ani historické externí vklady. Nejde o XIRR ani TWR.
            </div>
          </>
        )}
      </div>

      {!loading && !error && data && (
        <div style={{ overflowX: 'auto' }}>
          <table className="financial-table" style={{ minWidth: '1040px', width: '100%' }}>
            <thead>
              <tr>
                <th className="cell-text">Instrument</th>
                <th className="cell-number">Počáteční hodnota</th>
                <th className="cell-number">Koncová hodnota</th>
                <th className="cell-number">Nákupy</th>
                <th className="cell-number">Prodeje</th>
                <th className="cell-number">Příjmy</th>
                <th className="cell-number">Výsledek</th>
                <th className="cell-number">Výnos</th>
                <th className="cell-text">Kvalita</th>
              </tr>
            </thead>
            <tbody>
              {visibleInstruments.map((instrument) => {
                const resultClass = (instrument.profitCzk ?? 0) > 0
                  ? 'cell-positive'
                  : (instrument.profitCzk ?? 0) < 0
                    ? 'cell-negative'
                    : ''

                return (
                  <tr key={instrument.instrumentId}>
                    <td className="cell-text">
                      <span className="instrument-name">{instrument.instrumentName}</span>
                      {instrument.reason && <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '9px' }}>{instrument.reason}</div>}
                    </td>
                    <td className="cell-number">{instrument.startMarketValueCzk === null ? '—' : formatMoney(instrument.startMarketValueCzk)}</td>
                    <td className="cell-number">{instrument.endMarketValueCzk === null ? '—' : formatMoney(instrument.endMarketValueCzk)}</td>
                    <td className="cell-number">{formatMoney(instrument.buyCashCzk)}</td>
                    <td className="cell-number">{formatMoney(instrument.sellCashCzk)}</td>
                    <td className="cell-number cell-positive">{formatMoney(instrument.investmentIncomeCzk)}</td>
                    <td className={`cell-number ${resultClass}`}>{instrument.profitCzk === null ? '—' : formatMoney(instrument.profitCzk)}</td>
                    <td className={`cell-number ${resultClass}`}>{formatPercent(instrument.returnPercent)}</td>
                    <td className="cell-text"><span style={{ color: qualityColor(instrument.quality), fontWeight: 600 }}>{qualityLabel(instrument.quality)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value, tone = 'default' }: {
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
