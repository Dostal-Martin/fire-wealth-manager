import {
  useEffect,
  useState,
} from 'react'

import {
  getPerformanceStats,
} from '../services/performance'

type PerformanceData =
  Awaited<
    ReturnType<
      typeof getPerformanceStats
    >
  >

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    'cs-CZ',
    {
      style: 'currency',
      currency: 'CZK',
      maximumFractionDigits: 0,
    }
  ).format(value)
}

function formatCompactMoney(
  value: number
) {
  if (
    Math.abs(value) >=
    1_000_000
  ) {
    return `${(
      value / 1_000_000
    ).toLocaleString(
      'cs-CZ',
      {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      }
    )} mil. Kč`
  }

  if (
    Math.abs(value) >=
    1_000
  ) {
    return `${(
      value / 1_000
    ).toLocaleString(
      'cs-CZ',
      {
        maximumFractionDigits: 0,
      }
    )} tis. Kč`
  }

  return formatMoney(value)
}

function formatPercent(
  value: number | null,
  digits = 2,
  showPlus = true
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return 'N/A'
  }

  const prefix =
    showPlus &&
    value > 0
      ? '+'
      : ''

  return `${prefix}${value.toLocaleString(
    'cs-CZ',
    {
      minimumFractionDigits:
        digits,

      maximumFractionDigits:
        digits,
    }
  )} %`
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      `${value}T12:00:00`
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return date.toLocaleDateString(
    'cs-CZ'
  )
}

function performanceTone(
  value: number | null
):
  | 'default'
  | 'positive'
  | 'negative' {
  if (
    value === null ||
    value === 0
  ) {
    return 'default'
  }

  return value > 0
    ? 'positive'
    : 'negative'
}

export default function Performance() {
  const [
    data,
    setData,
  ] =
    useState<PerformanceData | null>(
      null
    )

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setErrorMessage('')

        const result =
          await getPerformanceStats()

        if (!cancelled) {
          setData(result)
        }
      } catch (error) {
        console.error(
          'Performance:',
          error
        )

        if (!cancelled) {
          setErrorMessage(
            'Výkonnost se nepodařilo načíst.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám výkonnost...
        </div>
      </div>
    )
  }

  if (
    !data ||
    errorMessage
  ) {
    return (
      <div className="page">
        <div className="error-box">
          {errorMessage ||
            'Výkonnost není dostupná.'}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            Výkonnost
          </h1>

          <p className="page-subtitle">
            Investiční výnos,
            dlouhodobý růst majetku
            a rizikové metriky.
          </p>
        </div>
      </header>

      {/* INVESTIČNÍ VÝKONNOST */}

      <SectionHeading
        title="Investiční výkonnost"
        description="Metriky výnosu portfolia a skutečně investovaných prostředků."
      />

      <section className="kpi-grid">
        <MetricCard
          label="XIRR"
          value={formatPercent(
            data.xirr,
            2
          )}
          description="Money-weighted výnos"
          tone={performanceTone(
            data.xirr
          )}
        />

        <MetricCard
          label="TWR"
          value={formatPercent(
            data.twr,
            2
          )}
          description={
            data.twr !== null
              ? 'Výnos bez vlivu externích vkladů'
              : 'Zatím není dostatek externích cashflow dat'
          }
          tone={performanceTone(
            data.twr
          )}
        />

        <MetricCard
          label="CAGR majetku"
          value={formatPercent(
            data.netWorthCagr,
            2
          )}
          description="Anualizovaný růst čistého jmění"
          tone={performanceTone(
            data.netWorthCagr
          )}
        />

        <MetricCard
          label="Celkový růst"
          value={formatPercent(
            data.totalGrowthPercent,
            1
          )}
          description={formatMoney(
            data.totalGrowth
          )}
          tone={performanceTone(
            data.totalGrowthPercent
          )}
        />
      </section>

      {/* MAJETEK A RIZIKO */}

      <SectionHeading
        title="Majetek a riziko"
        description="Historická úroveň majetku a pokles od dosaženého maxima."
      />

      <section className="kpi-grid">
        <MetricCard
          label="Počáteční majetek"
          value={formatCompactMoney(
            data.startValue
          )}
          description={formatMoney(
            data.startValue
          )}
        />

        <MetricCard
          label="Aktuální majetek"
          value={formatCompactMoney(
            data.currentValue
          )}
          description={formatMoney(
            data.currentValue
          )}
        />

        <MetricCard
          label="Historické maximum"
          value={formatCompactMoney(
            data.ath
          )}
          description={`Dosaženo ${formatDate(
            data.athDate
          )}`}
        />

        <MetricCard
          label="Drawdown"
          value={formatPercent(
            data.drawdown,
            1,
            false
          )}
          description="Pokles od historického maxima"
          tone={
            data.drawdown < 0
              ? 'negative'
              : 'default'
          }
        />
      </section>

      {/* METODIKA */}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Metodika
            </h2>

            <div className="panel-subtitle">
              Jak interpretovat jednotlivé
              ukazatele
            </div>
          </div>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: 'grid',

              gridTemplateColumns:
                'repeat(auto-fit, minmax(260px, 1fr))',

              gap: '28px',
            }}
          >
            <MethodBlock
              title="XIRR"
              description={
                <>
                  Zohledňuje výši i načasování
                  peněžních toků. Vyjadřuje
                  výnos skutečně investovaných
                  prostředků.
                </>
              }
            />

            <MethodBlock
              title="TWR"
              description={
                <>
                  Odděluje investiční výkonnost
                  od externích vkladů a výběrů.
                  Je vhodný pro porovnání
                  portfolia s benchmarkem.
                </>
              }
            />

            <MethodBlock
              title="CAGR majetku"
              description={
                <>
                  Anualizovaný růst čistého
                  jmění. Zahrnuje také nové
                  úspory a proto nejde o čistý
                  investiční výnos.
                </>
              }
            />

            <MethodBlock
              title="Drawdown"
              description={
                <>
                  Aktuální pokles hodnoty
                  majetku proti historickému
                  maximu. Nula znamená, že
                  portfolio je právě na ATH.
                </>
              }
            />
          </div>
        </div>
      </section>

      {/* TWR STATUS */}

      <section
        className="panel"
        style={{
          marginTop: '18px',
        }}
      >
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              TWR období
            </h2>

            <div className="panel-subtitle">
              Výpočet očištěný o externí
              cashflow
            </div>
          </div>
        </div>

        <div className="panel-body">
          <div
            style={{
              display: 'grid',

              gridTemplateColumns:
                'minmax(160px, 0.7fr) minmax(160px, 0.7fr) minmax(300px, 2fr)',

              gap: '24px',

              alignItems: 'start',
            }}
          >
            <InfoValue
              label="Od"
              value={formatDate(
                data.twrStartDate
              )}
            />

            <InfoValue
              label="Do"
              value={formatDate(
                data.twrEndDate
              )}
            />

            <InfoValue
              label="Stav"
              value={
                data.twrMessage
              }
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div
      style={{
        margin:
          '28px 0 14px',
      }}
    >
      <h2
        style={{
          margin: 0,

          color:
            'var(--text)',

          fontSize:
            '16px',

          fontWeight:
            600,
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin:
            '5px 0 0',

          color:
            'var(--text-muted)',

          fontSize:
            '12px',

          lineHeight:
            1.5,
        }}
      >
        {description}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  description,
  tone = 'default',
}: {
  label: string
  value: string
  description?: string

  tone?:
    | 'default'
    | 'positive'
    | 'negative'
}) {
  const valueClass =
    tone === 'positive'
      ? 'positive'
      : tone === 'negative'
        ? 'negative'
        : ''

  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {label}
      </div>

      <div
        className={`kpi-value ${valueClass}`}
      >
        {value}
      </div>

      {description && (
        <div className="kpi-description">
          {description}
        </div>
      )}
    </div>
  )
}

function MethodBlock({
  title,
  description,
}: {
  title: string
  description:
    React.ReactNode
}) {
  return (
    <div>
      <div
        style={{
          marginBottom:
            '7px',

          color:
            'var(--text)',

          fontSize:
            '13px',

          fontWeight:
            600,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color:
            'var(--text-secondary)',

          fontSize:
            '13px',

          lineHeight:
            1.65,
        }}
      >
        {description}
      </div>
    </div>
  )
}

function InfoValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <div
        style={{
          marginBottom:
            '6px',

          color:
            'var(--text-muted)',

          fontSize:
            '11px',

          fontWeight:
            600,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color:
            'var(--text)',

          fontSize:
            '13px',

          fontWeight:
            500,

          lineHeight:
            1.55,

          fontVariantNumeric:
            'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}