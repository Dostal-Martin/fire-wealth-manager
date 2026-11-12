import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import PortfolioPerformancePanel from '../components/PortfolioPerformancePanel'
import PerformanceReturnsPanel from '../components/PerformanceReturnsPanel'
import {
  getPerformanceStats,
} from '../services/performance'

type PerformanceData = Awaited<ReturnType<typeof getPerformanceStats>>

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('cs-CZ', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} mil. Kč`
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString('cs-CZ', {
      maximumFractionDigits: 0,
    })} tis. Kč`
  }

  return formatMoney(value)
}

function formatPercent(
  value: number | null,
  digits = 2,
  showPlus = true,
) {
  if (value === null || !Number.isFinite(value)) return 'N/A'
  const prefix = showPlus && value > 0 ? '+' : ''
  return `${prefix}${value.toLocaleString('cs-CZ', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('cs-CZ')
}

function performanceTone(value: number | null): 'default' | 'positive' | 'negative' {
  if (value === null || value === 0) return 'default'
  return value > 0 ? 'positive' : 'negative'
}

export default function Performance() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setErrorMessage('')
        const result = await getPerformanceStats()
        if (!cancelled) setData(result)
      } catch (error) {
        console.error('Performance:', error)
        if (!cancelled) setErrorMessage('Výkonnost se nepodařilo načíst.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div className="page"><div className="loading-box">Načítám výkonnost...</div></div>
  }

  if (!data || errorMessage) {
    return <div className="page"><div className="error-box">{errorMessage || 'Výkonnost není dostupná.'}</div></div>
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Výkonnost</h1>
          <p className="page-subtitle">
            Historická investiční výkonnost, výnos od evidovaných externích toků, dlouhodobý růst majetku a rizikové metriky.
          </p>
        </div>
      </header>

      <PortfolioPerformancePanel />

      <PerformanceReturnsPanel />

      <SectionHeading
        title="Dlouhodobý růst majetku"
        description="Růst čistého jmění včetně nových úspor. Nejde o čistý investiční výnos."
      />

      <section className="kpi-grid">
        <MetricCard
          label="CAGR majetku"
          value={formatPercent(data.netWorthCagr, 2)}
          description="Anualizovaný růst čistého jmění"
          tone={performanceTone(data.netWorthCagr)}
        />
        <MetricCard
          label="Celkový růst"
          value={formatPercent(data.totalGrowthPercent, 1)}
          description={formatMoney(data.totalGrowth)}
          tone={performanceTone(data.totalGrowthPercent)}
        />
      </section>

      <SectionHeading
        title="Majetek a riziko"
        description="Historická úroveň majetku a pokles od dosaženého maxima."
      />

      <section className="kpi-grid">
        <MetricCard label="Počáteční majetek" value={formatCompactMoney(data.startValue)} description={formatMoney(data.startValue)} />
        <MetricCard label="Aktuální majetek" value={formatCompactMoney(data.currentValue)} description={formatMoney(data.currentValue)} />
        <MetricCard label="Historické maximum" value={formatCompactMoney(data.ath)} description={`Dosaženo ${formatDate(data.athDate)}`} />
        <MetricCard
          label="Drawdown"
          value={formatPercent(data.drawdown, 1, false)}
          description="Pokles od historického maxima"
          tone={data.drawdown < 0 ? 'negative' : 'default'}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Metodika</h2>
            <div className="panel-subtitle">Jak interpretovat jednotlivé ukazatele</div>
          </div>
        </div>

        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '28px' }}>
            <MethodBlock
              title="Historický Total Return"
              description={<>Kombinuje historické ocenění v CZK, nákupy, prodeje, dividendy, kupóny a evidované úroky. Kvalita je označena jako úplná, částečná nebo nedostupná podle dostupnosti cen a NAV.</>}
            />
            <MethodBlock
              title="XIRR"
              description={<>Peněžně vážený roční výnos. Zohledňuje přesnou výši a datum evidovaných externích vkladů a výběrů. Historická období před spolehlivou evidencí externích toků nejsou dopočítávána.</>}
            />
            <MethodBlock
              title="TWR"
              description={<>Časově vážený výnos očištěný o evidovaný externí kapitál. Výnosy období mezi snapshoty se geometricky řetězí; při řídkých historických snapshotech jde o aproximaci.</>}
            />
            <MethodBlock
              title="CAGR majetku"
              description={<>Anualizovaný růst čistého jmění. Zahrnuje také nové úspory, proto nejde o čistý investiční výnos a může být dostupný za delší období než XIRR nebo TWR.</>}
            />
            <MethodBlock
              title="Drawdown"
              description={<>Aktuální pokles hodnoty majetku proti historickému maximu. Nula znamená, že portfolio je právě na ATH.</>}
            />
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: '18px' }}>
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Datové období majetku</h2>
            <div className="panel-subtitle">Období použité původní službou pro historické metriky čistého jmění</div>
          </div>
        </div>

        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px', alignItems: 'start' }}>
            <InfoValue label="Počáteční datum" value={formatDate(data.twrStartDate)} />
            <InfoValue label="Koncové datum" value={formatDate(data.twrEndDate)} />
            <InfoValue label="Původní stav výpočtu" value={data.twrMessage} />
          </div>

          <div style={{ marginTop: '14px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5 }}>
            Historický Total Return nahoře používá transakce, cenovou historii, historické FX a evidované investiční příjmy. XIRR a TWR používají pouze cashflow označené jako externí. Růst majetku vychází z historických snapshotů a může zahrnovat neevidované historické vklady.
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ margin: '28px 0 14px' }}>
      <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '16px', fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.5 }}>{description}</p>
    </div>
  )
}

function MetricCard({ label, value, description, tone = 'default' }: {
  label: string
  value: string
  description?: string
  tone?: 'default' | 'positive' | 'negative'
}) {
  const valueClass = tone === 'positive' ? 'positive' : tone === 'negative' ? 'negative' : ''
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${valueClass}`}>{value}</div>
      {description && <div className="kpi-description">{description}</div>}
    </div>
  )
}

function MethodBlock({ title, description }: { title: string; description: ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: '7px', color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>{title}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.65 }}>{description}</div>
    </div>
  )
}

function InfoValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ marginBottom: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 }}>{label}</div>
      <div style={{ color: 'var(--text)', fontSize: '13px', fontWeight: 500, lineHeight: 1.55, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}
