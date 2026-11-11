import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  getCurrentNetWorth,
  getLocalDateString,
} from '../services/netWorth'

import {
  getNetWorthHistory,
} from '../services/netWorthHistory'

type RangeOption =
  | '1Y'
  | '3Y'
  | '5Y'
  | 'MAX'

type NetWorthPoint = {
  date: string
  amount: number
}

const DAY_MS =
  24 * 60 * 60 * 1000

/**
 * Spojí historické snapshoty s aktuální live
 * hodnotou portfolia.
 *
 * Pokud dnešní snapshot existuje, je pouze
 * pro účely UI nahrazen live hodnotou.
 *
 * Pokud dnešní snapshot neexistuje, přidá se
 * virtuální dnešní bod.
 *
 * Do databáze tato funkce nic nezapisuje.
 */
function mergeLiveNetWorth(
  history: NetWorthPoint[],
  liveAmount: number,
  today: string
): NetWorthPoint[] {
  const historicalPoints =
    history.filter(
      (point) =>
        point.date !== today
    )

  return [
    ...historicalPoints,

    {
      date: today,
      amount: liveAmount,
    },
  ].sort(
    (a, b) =>
      a.date.localeCompare(
        b.date
      )
  )
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
  const absolute =
    Math.abs(value)

  if (
    absolute >=
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
    absolute >= 1_000
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
  if (
    !Number.isFinite(value)
  ) {
    return '—'
  }

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

function formatDate(
  value: string
) {
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

function subtractYears(
  dateString: string,
  years: number
) {
  const date =
    new Date(
      `${dateString}T12:00:00Z`
    )

  date.setUTCFullYear(
    date.getUTCFullYear() -
      years
  )

  return date
    .toISOString()
    .slice(0, 10)
}

function calculateCagr(
  startValue: number,
  endValue: number,
  startDate: string,
  endDate: string
) {
  if (
    startValue <= 0 ||
    endValue <= 0
  ) {
    return 0
  }

  const start =
    new Date(
      `${startDate}T12:00:00Z`
    )

  const end =
    new Date(
      `${endDate}T12:00:00Z`
    )

  const years =
    (
      end.getTime() -
      start.getTime()
    ) /
    (
      365.25 *
      DAY_MS
    )

  if (years <= 0) {
    return 0
  }

  return (
    (
      Math.pow(
        endValue /
          startValue,
        1 / years
      ) -
      1
    ) *
    100
  )
}

export default function NetWorth() {
  const [
    history,
    setHistory,
  ] =
    useState<
      NetWorthPoint[]
    >([])

  const [
    snapshotCount,
    setSnapshotCount,
  ] =
    useState(0)

  const [
    selectedRange,
    setSelectedRange,
  ] =
    useState<RangeOption>(
      'MAX'
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

        const [
          data,
          current,
        ] =
          await Promise.all([
            getNetWorthHistory(),
            getCurrentNetWorth(),
          ])

        if (cancelled) {
          return
        }

        const normalized =
          (data ?? [])
            .map(
              (row) => ({
                date:
                  row.date,

                amount:
                  Number(
                    row.amount
                  ),
              })
            )
            .filter(
              (
                row
              ): row is NetWorthPoint =>
                Boolean(
                  row.date
                ) &&
                Number.isFinite(
                  row.amount
                )
            )
            .sort(
              (a, b) =>
                a.date.localeCompare(
                  b.date
                )
            )

        if (
          !Number.isFinite(
            current.netWorth
          )
        ) {
          throw new Error(
            'Aktuální čisté jmění není platné číslo.'
          )
        }

        const today =
          getLocalDateString()

        const historyWithLivePoint =
          mergeLiveNetWorth(
            normalized,
            current.netWorth,
            today
          )

        setSnapshotCount(
          normalized.length
        )

        setHistory(
          historyWithLivePoint
        )
      } catch (error) {
        console.error(
          'Net worth:',
          error
        )

        if (!cancelled) {
          setErrorMessage(
            'Historii majetku se nepodařilo načíst.'
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

  const metrics =
    useMemo(() => {
      if (
        history.length === 0
      ) {
        return null
      }

      const first =
        history[0]

      const latest =
        history[
          history.length - 1
        ]

      let ath =
        first

      for (
        const point of
        history
      ) {
        if (
          point.amount >
          ath.amount
        ) {
          ath = point
        }
      }

      const growth =
        latest.amount -
        first.amount

      const growthPercent =
        first.amount > 0
          ? (
              latest.amount /
                first.amount -
              1
            ) * 100
          : 0

      const cagr =
        calculateCagr(
          first.amount,
          latest.amount,
          first.date,
          latest.date
        )

      const drawdown =
        ath.amount > 0
          ? (
              latest.amount /
                ath.amount -
              1
            ) * 100
          : 0

      return {
        first,
        latest,
        ath,
        growth,
        growthPercent,
        cagr,
        drawdown,
      }
    }, [history])

  const chartData =
    useMemo(() => {
      if (
        history.length === 0 ||
        selectedRange ===
          'MAX'
      ) {
        return history
      }

      const latest =
        history[
          history.length - 1
        ]

      const years =
        selectedRange ===
        '1Y'
          ? 1
          : selectedRange ===
              '3Y'
            ? 3
            : 5

      const startDate =
        subtractYears(
          latest.date,
          years
        )

      return history.filter(
        (point) =>
          point.date >=
          startDate
      )
    }, [
      history,
      selectedRange,
    ])

  const periodStats =
    useMemo(() => {
      if (
        chartData.length === 0
      ) {
        return null
      }

      const first =
        chartData[0]

      const latest =
        chartData[
          chartData.length - 1
        ]

      const change =
        latest.amount -
        first.amount

      const changePercent =
        first.amount > 0
          ? (
              latest.amount /
                first.amount -
              1
            ) * 100
          : 0

      return {
        first,
        latest,
        change,
        changePercent,
      }
    }, [chartData])

  if (loading) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám historii
          majetku...
        </div>
      </div>
    )
  }

  if (
    errorMessage ||
    !metrics
  ) {
    return (
      <div className="page">
        <div
          className={
            errorMessage
              ? 'error-box'
              : 'empty-box'
          }
        >
          {errorMessage ||
            'Historie majetku zatím neobsahuje žádná data.'}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            Vývoj majetku
          </h1>

          <p className="page-subtitle">
            Historický vývoj čistého
            jmění. Poslední dnešní bod
            používá aktuální hodnotu
            portfolia.
          </p>
        </div>

        <div className="networth-header-meta">
          {snapshotCount.toLocaleString(
            'cs-CZ'
          )}
          {' '}
          uložených snapshotů
          <br />
          aktuální k{' '}
          {formatDate(
            metrics.latest.date
          )}
        </div>
      </header>

      <section className="kpi-grid">
        <MetricCard
          label="Aktuální majetek"
          value={formatCompactMoney(
            metrics.latest.amount
          )}
          description={formatMoney(
            metrics.latest.amount
          )}
        />

        <MetricCard
          label="Celkový růst"
          value={formatCompactMoney(
            metrics.growth
          )}
          description={formatPercent(
            metrics.growthPercent
          )}
          tone={
            metrics.growth > 0
              ? 'positive'
              : metrics.growth < 0
                ? 'negative'
                : 'default'
          }
        />

        <MetricCard
          label="CAGR majetku"
          value={formatPercent(
            metrics.cagr
          )}
          description="Anualizovaný růst"
          tone={
            metrics.cagr > 0
              ? 'positive'
              : metrics.cagr < 0
                ? 'negative'
                : 'default'
          }
        />

        <MetricCard
          label="Historické maximum"
          value={formatCompactMoney(
            metrics.ath.amount
          )}
          description={formatDate(
            metrics.ath.date
          )}
        />

        <MetricCard
          label="Drawdown"
          value={formatPercent(
            metrics.drawdown
          )}
          description="Od historického maxima"
          tone={
            metrics.drawdown < 0
              ? 'negative'
              : 'default'
          }
        />

        <MetricCard
          label="Počáteční majetek"
          value={formatCompactMoney(
            metrics.first.amount
          )}
          description={formatDate(
            metrics.first.date
          )}
        />

        <MetricCard
          label="Délka historie"
          value={`${(
            (
              new Date(
                `${metrics.latest.date}T12:00:00`
              ).getTime() -
              new Date(
                `${metrics.first.date}T12:00:00`
              ).getTime()
            ) /
            (
              365.25 *
              DAY_MS
            )
          ).toLocaleString(
            'cs-CZ',
            {
              maximumFractionDigits:
                1,
            }
          )} let`}
          description={`${formatDate(
            metrics.first.date
          )} až ${formatDate(
            metrics.latest.date
          )}`}
        />

        <MetricCard
          label="Datové body"
          value={history.length.toLocaleString(
            'cs-CZ'
          )}
          description={
            history.length >
            snapshotCount
              ? 'Snapshoty + live bod'
              : 'Včetně dnešní live hodnoty'
          }
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Čisté jmění
            </h2>

            <div className="panel-subtitle">
              Historické snapshoty a
              dnešní live hodnota v CZK
            </div>
          </div>

          <RangeSelector
            value={
              selectedRange
            }
            onChange={
              setSelectedRange
            }
          />
        </div>

        <div className="panel-body">
          {periodStats && (
            <div className="networth-period-summary">
              <SummaryValue
                label="Začátek období"
                value={formatMoney(
                  periodStats
                    .first.amount
                )}
                detail={formatDate(
                  periodStats
                    .first.date
                )}
              />

              <SummaryValue
                label="Konec období"
                value={formatMoney(
                  periodStats
                    .latest.amount
                )}
                detail={formatDate(
                  periodStats
                    .latest.date
                )}
              />

              <SummaryValue
                label="Změna"
                value={formatMoney(
                  periodStats.change
                )}
                detail={formatPercent(
                  periodStats
                    .changePercent
                )}
                tone={
                  periodStats.change >
                  0
                    ? 'positive'
                    : periodStats.change <
                        0
                      ? 'negative'
                      : 'default'
                }
              />
            </div>
          )}

          <ResponsiveContainer
            width="100%"
            height={470}
          >
            <LineChart
              data={chartData}
              margin={{
                top: 10,
                right: 18,
                bottom: 5,
                left: 8,
              }}
            >
              <CartesianGrid
                stroke="#eef0f3"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                minTickGap={40}
                tickFormatter={(
                  value
                ) => {
                  const date =
                    new Date(
                      `${value}T12:00:00`
                    )

                  return date.toLocaleDateString(
                    'cs-CZ',
                    {
                      month:
                        '2-digit',

                      year:
                        '2-digit',
                    }
                  )
                }}
                tick={chartTick}
                axisLine={{
                  stroke:
                    '#e4e7ec',
                }}
                tickLine={false}
              />

              <YAxis
                width={78}
                tickFormatter={(
                  value
                ) =>
                  `${(
                    Number(value) /
                    1_000_000
                  ).toLocaleString(
                    'cs-CZ',
                    {
                      maximumFractionDigits:
                        1,
                    }
                  )} mil.`
                }
                tick={chartTick}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                content={
                  <NetWorthTooltip />
                }
              />

              <Line
                type="monotone"
                dataKey="amount"
                stroke="#53657d"
                strokeWidth={2.25}
                dot={false}
                activeDot={{
                  r: 4,

                  fill:
                    '#344054',

                  stroke:
                    '#ffffff',

                  strokeWidth:
                    2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="networth-chart-note">
            Historické body vycházejí
            z uložených snapshotů.
            Dnešní poslední bod používá
            aktuální hodnotu pozic.
            Graf zobrazuje čisté jmění,
            nikoliv čistou investiční
            výkonnost. Změny mohou
            zahrnovat nové vklady,
            výběry a změny hodnoty
            investic.
          </div>
        </div>
      </section>
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

function RangeSelector({
  value,
  onChange,
}: {
  value: RangeOption

  onChange:
    (value: RangeOption) =>
      void
}) {
  const options:
    RangeOption[] = [
      '1Y',
      '3Y',
      '5Y',
      'MAX',
    ]

  return (
    <div className="networth-range-selector">
      {options.map(
        (option) => (
          <button
            key={option}
            className={
              value === option
                ? 'networth-range-button networth-range-button-active'
                : 'networth-range-button'
            }
            onClick={() =>
              onChange(
                option
              )
            }
          >
            {option}
          </button>
        )
      )}
    </div>
  )
}

function SummaryValue({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  detail?: string

  tone?:
    | 'default'
    | 'positive'
    | 'negative'
}) {
  const color =
    tone === 'positive'
      ? 'var(--success)'
      : tone === 'negative'
        ? 'var(--danger)'
        : 'var(--text)'

  return (
    <div className="networth-summary-value">
      <div className="networth-summary-label">
        {label}
      </div>

      <div
        className="networth-summary-number"
        style={{
          color,
        }}
      >
        {value}
      </div>

      {detail && (
        <div className="networth-summary-detail">
          {detail}
        </div>
      )}
    </div>
  )
}

function NetWorthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean

  payload?: Array<{
    value?: number
  }>

  label?: string
}) {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null
  }

  return (
    <div className="networth-tooltip">
      <div className="networth-tooltip-date">
        {label
          ? formatDate(
              label
            )
          : '—'}
      </div>

      <div className="networth-tooltip-value">
        {formatMoney(
          Number(
            payload[0].value ??
            0
          )
        )}
      </div>
    </div>
  )
}

const chartTick = {
  fill: '#98a2b3',
  fontSize: 11,
}