import { useEffect, useState } from 'react'
import type { PerformanceReturns, ReturnMetric } from '../domain/performanceReturns'
import { getPerformanceReturns } from '../services/performanceReturns'

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${(value * 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} %`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('cs-CZ')
}

function Metric({
  label,
  metric,
  description,
}: {
  label: string
  metric: ReturnMetric
  description: string
}) {
  const value = metric.value ?? 0

  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div
        className={`kpi-value ${metric.available && value > 0 ? 'positive' : metric.available && value < 0 ? 'negative' : ''}`}
      >
        {metric.available ? formatPercent(metric.value) : 'Nedostupné'}
      </div>
      <div className="kpi-description">
        {metric.available
          ? `${formatDate(metric.startDate)} až ${formatDate(metric.endDate)}`
          : metric.reason}
      </div>
      <div style={{ marginTop: '5px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.4 }}>
        {description}
      </div>
    </div>
  )
}

export default function PerformanceReturnsPanel({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const [data, setData] = useState<PerformanceReturns | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError('')
        const result = await getPerformanceReturns()
        if (!cancelled) setData(result)
      } catch (reason) {
        console.error('XIRR/TWR:', reason)
        if (!cancelled) setError('Výnosové metriky se nepodařilo načíst.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [refreshVersion])

  if (loading) {
    return <div className="loading-box" style={{ marginBottom: '18px' }}>Načítám XIRR a TWR...</div>
  }

  if (error || !data) {
    return <div className="error-box" style={{ marginBottom: '18px' }}>{error || 'Výnosové metriky nejsou dostupné.'}</div>
  }

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Výnos od externích peněžních toků</h2>
          <div className="panel-subtitle">
            Výpočet začíná prvním evidovaným vkladem nebo výběrem: {formatDate(data.firstExternalCashflowDate)}
          </div>
        </div>
      </div>

      <div className="panel-body">
        <div className="kpi-grid">
          <Metric
            label="XIRR"
            metric={data.xirr}
            description="Peněžně vážený roční výnos zohledňující přesná data vkladů a výběrů."
          />
          <Metric
            label="TWR"
            metric={data.twr}
            description="Časově vážený výnos očištěný o externí kapitál mezi snapshoty portfolia."
          />
        </div>

        <div style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5 }}>
          TWR používá mezisnapshotová období a předpokládá externí tok na konci dne. Při řídkých snapshotech je výsledek aproximací. Historický CAGR čistého jmění je odlišná metrika a nemá se s XIRR ani TWR zaměňovat.
        </div>
      </div>
    </section>
  )
}
