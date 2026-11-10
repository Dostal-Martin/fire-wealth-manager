import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  getIncomeStats,
} from '../services/income'

type IncomeData =
  Awaited<
    ReturnType<
      typeof getIncomeStats
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
  value: number
) {
  const prefix =
    value > 0
      ? '+'
      : ''

  return `${prefix}${value.toLocaleString(
    'cs-CZ',
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )} %`
}

export default function Income() {
  const [
    data,
    setData,
  ] =
    useState<IncomeData | null>(
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
          await getIncomeStats()

        if (!cancelled) {
          setData(result)
        }
      } catch (error) {
        console.error(
          'Income:',
          error
        )

        if (!cancelled) {
          setErrorMessage(
            'Příjmy se nepodařilo načíst.'
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

  const analytics =
    useMemo(() => {
      if (!data) {
        return {
          latestYear: null,
          latestIncome: 0,
          previousIncome: 0,
          yoyGrowth: null as
            | number
            | null,
          averageAnnualIncome: 0,
          averageMonthlyIncome: 0,
        }
      }

      const yearly =
        [...data.yearlyIncome]
          .sort(
            (a, b) =>
              Number(a.year) -
              Number(b.year)
          )

      const latest =
        yearly[
          yearly.length - 1
        ]

      const previous =
        yearly[
          yearly.length - 2
        ]

      const latestIncome =
        latest
          ? Number(
              latest.total
            )
          : 0

      const previousIncome =
        previous
          ? Number(
              previous.total
            )
          : 0

      const yoyGrowth =
        previousIncome > 0
          ? (
              latestIncome /
                previousIncome -
              1
            ) * 100
          : null

      const averageAnnualIncome =
        yearly.length > 0
          ? yearly.reduce(
              (
                sum,
                row
              ) =>
                sum +
                Number(
                  row.total
                ),
              0
            ) /
            yearly.length
          : 0

      return {
        latestYear:
          latest?.year ??
          null,

        latestIncome,

        previousIncome,

        yoyGrowth,

        averageAnnualIncome,

        averageMonthlyIncome:
          averageAnnualIncome /
          12,
      }
    }, [data])

  if (loading) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám příjmy...
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
            'Příjmy nejsou dostupné.'}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            Příjmy
          </h1>

          <p className="page-subtitle">
            Přehled dividend,
            kupónových plateb a
            vývoje pasivního příjmu.
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
          {data.yearlyIncome.length}
          {' '}
          sledovaných období
        </div>
      </header>

      <section className="kpi-grid">
        <MetricCard
          label="Dividendy celkem"
          value={formatCompactMoney(
            data.dividendTotal
          )}
          description={formatMoney(
            data.dividendTotal
          )}
        />

        <MetricCard
          label="Kupóny celkem"
          value={formatCompactMoney(
            data.couponTotal
          )}
          description={formatMoney(
            data.couponTotal
          )}
        />

        <MetricCard
          label="Pasivní příjem celkem"
          value={formatCompactMoney(
            data.passiveIncome
          )}
          description={formatMoney(
            data.passiveIncome
          )}
        />

        <MetricCard
          label={
            analytics.latestYear
              ? `Příjem ${analytics.latestYear}`
              : 'Poslední rok'
          }
          value={formatCompactMoney(
            analytics.latestIncome
          )}
          description={
            analytics.yoyGrowth !==
            null
              ? `${formatPercent(
                  analytics.yoyGrowth
                )} meziročně`
              : 'Bez předchozího srovnání'
          }
          tone={
            analytics.yoyGrowth !==
              null &&
            analytics.yoyGrowth > 0
              ? 'positive'
              : analytics.yoyGrowth !==
                    null &&
                  analytics.yoyGrowth <
                    0
                ? 'negative'
                : 'default'
          }
        />
      </section>

      <div className="income-summary-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Struktura příjmů
              </h2>

              <div className="panel-subtitle">
                Podíl dividend a kupónů
                na celkovém příjmu
              </div>
            </div>
          </div>

          <div className="panel-body">
            <IncomeStructure
              dividends={
                data.dividendTotal
              }
              coupons={
                data.couponTotal
              }
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Průměrný příjem
              </h2>

              <div className="panel-subtitle">
                Jednoduchý průměr
                sledovaných kalendářních
                období
              </div>
            </div>
          </div>

          <div className="panel-body">
            <div className="income-average-row">
              <div>
                <div className="income-average-label">
                  Ročně
                </div>

                <div className="income-average-value">
                  {formatMoney(
                    analytics
                      .averageAnnualIncome
                  )}
                </div>
              </div>

              <div>
                <div className="income-average-label">
                  Měsíčně
                </div>

                <div className="income-average-value">
                  {formatMoney(
                    analytics
                      .averageMonthlyIncome
                  )}
                </div>
              </div>
            </div>

            <div className="income-method-note">
              Měsíční údaj je pouze
              annualizovaný průměr.
              Dividendové a kupónové
              platby nejsou v průběhu
              roku rovnoměrné.
            </div>
          </div>
        </section>
      </div>

      <section
        className="panel"
        style={{
          marginTop: '18px',
        }}
      >
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Příjmy podle let
            </h2>

            <div className="panel-subtitle">
              Dividendy a kupóny
              podle kalendářního roku
            </div>
          </div>
        </div>

        {data.yearlyIncome.length >
        0 ? (
          <div
            style={{
              overflowX:
                'auto',
            }}
          >
            <table className="financial-table">
              <thead>
                <tr>
                  <th className="cell-text">
                    Rok
                  </th>

                  <th className="cell-number">
                    Dividendy
                  </th>

                  <th className="cell-number">
                    Kupóny
                  </th>

                  <th className="cell-number">
                    Celkem
                  </th>

                  <th className="cell-number">
                    Meziročně
                  </th>

                  <th className="cell-number">
                    Podíl dividend
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.yearlyIncome.map(
                  (
                    row,
                    index
                  ) => {
                    const dividends =
                      Number(
                        row.dividends
                      )

                    const coupons =
                      Number(
                        row.coupons
                      )

                    const total =
                      Number(
                        row.total
                      )

                    const previous =
                      index > 0
                        ? Number(
                            data
                              .yearlyIncome[
                              index -
                                1
                            ].total
                          )
                        : null

                    const growth =
                      previous !==
                        null &&
                      previous > 0
                        ? (
                            total /
                              previous -
                            1
                          ) *
                          100
                        : null

                    const dividendShare =
                      total > 0
                        ? (
                            dividends /
                            total
                          ) *
                          100
                        : 0

                    return (
                      <tr
                        key={
                          row.year
                        }
                      >
                        <td className="cell-text">
                          <strong
                            style={{
                              fontWeight:
                                600,
                            }}
                          >
                            {row.year}
                          </strong>
                        </td>

                        <td className="cell-number">
                          {formatMoney(
                            dividends
                          )}
                        </td>

                        <td className="cell-number">
                          {formatMoney(
                            coupons
                          )}
                        </td>

                        <td className="cell-number">
                          <strong
                            style={{
                              fontWeight:
                                600,
                            }}
                          >
                            {formatMoney(
                              total
                            )}
                          </strong>
                        </td>

                        <td
                          className={[
                            'cell-number',

                            growth !==
                              null &&
                            growth > 0
                              ? 'cell-positive'
                              : '',

                            growth !==
                              null &&
                            growth < 0
                              ? 'cell-negative'
                              : '',
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              ' '
                            )}
                        >
                          {growth ===
                          null
                            ? '—'
                            : formatPercent(
                                growth
                              )}
                        </td>

                        <td className="cell-number">
                          {dividendShare.toLocaleString(
                            'cs-CZ',
                            {
                              minimumFractionDigits:
                                1,

                              maximumFractionDigits:
                                1,
                            }
                          )}
                          {' %'}
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>

              <tfoot>
                <tr className="income-total-row">
                  <td>
                    Celkem
                  </td>

                  <td className="cell-number">
                    {formatMoney(
                      data.dividendTotal
                    )}
                  </td>

                  <td className="cell-number">
                    {formatMoney(
                      data.couponTotal
                    )}
                  </td>

                  <td className="cell-number">
                    <strong>
                      {formatMoney(
                        data.passiveIncome
                      )}
                    </strong>
                  </td>

                  <td />

                  <td
                    className="cell-number"
                  >
                    {data.passiveIncome >
                    0
                      ? `${(
                          data.dividendTotal /
                          data.passiveIncome *
                          100
                        ).toLocaleString(
                          'cs-CZ',
                          {
                            minimumFractionDigits:
                              1,

                            maximumFractionDigits:
                              1,
                          }
                        )} %`
                      : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div
            className="empty-box"
            style={{
              margin: '20px',
            }}
          >
            Zatím nejsou dostupná
            žádná příjmová data.
          </div>
        )}
      </section>

      <div className="income-footer-note">
        Příjmy zahrnují transakce
        typu dividendy a kupóny
        evidované v cashflow.
        Nezahrnují nerealizované
        zisky ani růst hodnoty
        instrumentů.
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

function IncomeStructure({
  dividends,
  coupons,
}: {
  dividends: number
  coupons: number
}) {
  const total =
    dividends + coupons

  const dividendShare =
    total > 0
      ? dividends /
        total *
        100
      : 0

  const couponShare =
    total > 0
      ? coupons /
        total *
        100
      : 0

  return (
    <div>
      <div className="income-structure-row">
        <div>
          <div className="income-structure-label">
            Dividendy
          </div>

          <div className="income-structure-value">
            {formatMoney(
              dividends
            )}
          </div>
        </div>

        <div className="income-structure-percent">
          {dividendShare.toLocaleString(
            'cs-CZ',
            {
              minimumFractionDigits:
                1,
              maximumFractionDigits:
                1,
            }
          )}
          {' %'}
        </div>
      </div>

      <div className="income-progress">
        <div
          className="income-progress-value"
          style={{
            width:
              `${Math.min(
                Math.max(
                  dividendShare,
                  0
                ),
                100
              )}%`,
          }}
        />
      </div>

      <div
        className="income-structure-row"
        style={{
          marginTop: '20px',
        }}
      >
        <div>
          <div className="income-structure-label">
            Kupóny
          </div>

          <div className="income-structure-value">
            {formatMoney(
              coupons
            )}
          </div>
        </div>

        <div className="income-structure-percent">
          {couponShare.toLocaleString(
            'cs-CZ',
            {
              minimumFractionDigits:
                1,
              maximumFractionDigits:
                1,
            }
          )}
          {' %'}
        </div>
      </div>

      <div className="income-progress">
        <div
          className="income-progress-value income-progress-secondary"
          style={{
            width:
              `${Math.min(
                Math.max(
                  couponShare,
                  0
                ),
                100
              )}%`,
          }}
        />
      </div>
    </div>
  )
}