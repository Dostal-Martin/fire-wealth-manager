import {
  useEffect,
  useState,
} from 'react'

import {
  getInstrumentCount,
} from '../services/dashboard'

import {
  getPortfolioStats,
} from '../services/positions'

import {
  getXirr,
} from '../services/xirr'

import {
  getFireMetrics,
} from '../services/fire'

import {
  getTopPositions,
  type TopPosition,
} from '../services/topPositions'

import {
  getNetWorthStats,
} from '../services/netWorthStats'

import AssetAllocationChart from '../components/AssetAllocationChart'

type DashboardData = {
  instrumentCount: number

  portfolioValue: number
  investedValue: number
  profit: number
  positionCount: number

  xirr: number

  fireProgress: number
  fireEta: string

  ath: number
  drawdown: number
  cagr: number

  topPositions:
    TopPosition[]
}

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
      value /
      1_000_000
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
      value /
      1_000
    ).toLocaleString(
      'cs-CZ',
      {
        maximumFractionDigits: 0,
      }
    )} tis. Kč`
  }

  return formatMoney(
    value
  )
}

function formatPercent(
  value: number,
  digits = 1,
  showPlus = false
) {
  if (
    !Number.isFinite(value)
  ) {
    return '—'
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

export default function Dashboard() {
  const [
    data,
    setData,
  ] =
    useState<DashboardData | null>(
      null
    )

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setErrorMessage('')

        const [
          instrumentCount,
          stats,
          xirrValue,
          fire,
          topPositions,
          netWorth,
        ] = await Promise.all([
          getInstrumentCount(),

          getPortfolioStats(),

          getXirr(),

          getFireMetrics(),

          getTopPositions(),

          Promise.resolve(
            getNetWorthStats()
          ),
        ])

        if (cancelled) {
          return
        }

        const xirr =
          Number(
            xirrValue
          )

        setData({
          instrumentCount:
            Number(
              instrumentCount
            ),

          portfolioValue:
            Number(
              stats
                .portfolioValue
            ),

          investedValue:
            Number(
              stats
                .investedValue
            ),

          profit:
            Number(
              stats.profit
            ),

          positionCount:
            Number(
              stats
                .positionCount
            ),

          xirr:
            Number.isFinite(
              xirr
            )
              ? xirr
              : 0,

          fireProgress:
            Number(
              fire.progress
            ),

          fireEta:
            fire.estimatedDate
              .toLocaleDateString(
                'cs-CZ',
                {
                  month:
                    'long',

                  year:
                    'numeric',
                }
              ),

          ath:
            Number(
              netWorth.ath
            ),

          drawdown:
            Number(
              netWorth
                .drawdown
            ),

          cagr:
            Number(
              netWorth
                .cagrSinceStart
            ),

          topPositions,
        })
      } catch (error) {
        console.error(
          'Dashboard:',
          error
        )

        if (!cancelled) {
          setErrorMessage(
            'Dashboard se nepodařilo načíst.'
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
          Načítám dashboard...
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
            'Dashboard není dostupný.'}
        </div>
      </div>
    )
  }

  const profitPercent =
    data.investedValue > 0
      ? (
          data.profit /
          data.investedValue
        ) * 100
      : 0

  const fireProgressWidth =
    Math.min(
      Math.max(
        data.fireProgress,
        0
      ),
      100
    )

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            Přehled majetku
          </h1>

          <p className="page-subtitle">
            Souhrn portfolia,
            dlouhodobé výkonnosti
            a postupu k finanční
            nezávislosti.
          </p>
        </div>

        <div
          style={{
            color:
              'var(--text-muted)',

            fontSize:
              '12px',

            textAlign:
              'right',

            lineHeight:
              1.6,
          }}
        >
          {data.positionCount}
          {' '}
          pozic
          <br />

          {data.instrumentCount}
          {' '}
          instrumentů
        </div>
      </header>

      <section className="kpi-grid">
        <MetricCard
          label="Hodnota portfolia"
          value={formatCompactMoney(
            data.portfolioValue
          )}
          description={formatMoney(
            data.portfolioValue
          )}
        />

        <MetricCard
          label="Investovaný kapitál"
          value={formatCompactMoney(
            data.investedValue
          )}
          description={formatMoney(
            data.investedValue
          )}
        />

        <MetricCard
          label="Nerealizovaný výsledek"
          value={formatCompactMoney(
            data.profit
          )}
          description={formatPercent(
            profitPercent,
            1,
            true
          )}
          tone={
            data.profit > 0
              ? 'positive'
              : data.profit < 0
                ? 'negative'
                : 'default'
          }
        />

        <MetricCard
          label="XIRR"
          value={formatPercent(
            data.xirr,
            2,
            true
          )}
          description="Money-weighted výnos"
          tone={
            data.xirr > 0
              ? 'positive'
              : data.xirr < 0
                ? 'negative'
                : 'default'
          }
        />

        <MetricCard
          label="FIRE progress"
          value={formatPercent(
            data.fireProgress,
            1
          )}
          description={`Odhad: ${data.fireEta}`}
        />

        <MetricCard
          label="CAGR majetku"
          value={formatPercent(
            data.cagr,
            1,
            true
          )}
          description="Anualizovaný růst čistého jmění"
          tone={
            data.cagr > 0
              ? 'positive'
              : data.cagr < 0
                ? 'negative'
                : 'default'
          }
        />

        <MetricCard
          label="Historické maximum"
          value={formatCompactMoney(
            data.ath
          )}
          description={formatMoney(
            data.ath
          )}
        />

        <MetricCard
          label="Drawdown"
          value={formatPercent(
            data.drawdown,
            1
          )}
          description="Od historického maxima"
          tone={
            data.drawdown < 0
              ? 'negative'
              : 'default'
          }
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Struktura portfolia
              </h2>

              <div className="panel-subtitle">
                Aktuální rozložení
                podle tříd aktiv
              </div>
            </div>
          </div>

          <div className="panel-body">
            <AssetAllocationChart />
          </div>
        </section>

        <div
          style={{
            display: 'grid',
            gap: '18px',
          }}
        >
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  FIRE
                </h2>

                <div className="panel-subtitle">
                  Postup k finanční
                  nezávislosti
                </div>
              </div>

              <div
                style={{
                  color:
                    'var(--text-secondary)',

                  fontSize:
                    '12px',
                }}
              >
                {data.fireEta}
              </div>
            </div>

            <div className="panel-body">
              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'space-between',

                  alignItems:
                    'baseline',

                  gap:
                    '20px',

                  marginBottom:
                    '13px',
                }}
              >
                <span
                  style={{
                    color:
                      'var(--text-secondary)',

                    fontSize:
                      '13px',
                  }}
                >
                  Splněno
                </span>

                <strong
                  style={{
                    fontSize:
                      '18px',

                    fontWeight:
                      600,

                    fontVariantNumeric:
                      'tabular-nums',
                  }}
                >
                  {formatPercent(
                    data.fireProgress,
                    1
                  )}
                </strong>
              </div>

              <div className="progress-track">
                <div
                  className="progress-value"
                  style={{
                    width:
                      `${fireProgressWidth}%`,
                  }}
                />
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  Největší pozice
                </h2>

                <div className="panel-subtitle">
                  Podle současné
                  tržní hodnoty
                </div>
              </div>
            </div>

            <div className="panel-body">
              {data.topPositions.map(
                (
                  position
                ) => {
                  const value =
                    position.current_value

                  const weight =
                    data.portfolioValue >
                    0
                      ? (
                          value /
                          data.portfolioValue
                        ) * 100
                      : 0

                  return (
                    <div
                      key={
                        position.id
                      }
                      className="top-position-row"
                    >
                      <div
                        style={{
                          minWidth:
                            0,
                        }}
                      >
                        <div className="instrument-name">
                          {position
                            .instruments
                            ?.name ??
                            'Neznámý instrument'}
                        </div>

                        <div
                          style={{
                            marginTop:
                              '3px',

                            color:
                              'var(--text-muted)',

                            fontSize:
                              '11px',
                          }}
                        >
                          {formatPercent(
                            weight,
                            1
                          )}
                          {' '}
                          portfolia
                        </div>
                      </div>

                      <div className="top-position-value">
                        {formatCompactMoney(
                          value
                        )}
                      </div>
                    </div>
                  )
                }
              )}

              {data.topPositions.length ===
                0 && (
                <div className="empty-box">
                  Žádné pozice.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
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