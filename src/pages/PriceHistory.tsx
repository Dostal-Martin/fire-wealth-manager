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
  getInstrumentPriceHistory,
  getPriceInstruments,
  type PriceHistoryRow,
  type PriceInstrument,
} from '../services/priceHistory'

type RangeOption =
  | '1Y'
  | '3Y'
  | '5Y'
  | 'MAX'

type Metrics = {
  currentPrice: number
  currentDate: string

  ytd: number | null
  oneYear: number | null
  threeYearCagr: number | null
  fiveYearCagr: number | null

  ath: number
  athDate: string

  drawdown: number
}

const millisecondsPerDay =
  24 * 60 * 60 * 1000

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

function formatPrice(
  value: number,
  currency: string | null
) {
  const formatted =
    value.toLocaleString(
      'cs-CZ',
      {
        minimumFractionDigits:
          0,

        maximumFractionDigits:
          4,
      }
    )

  return currency
    ? `${formatted} ${currency}`
    : formatted
}

function formatPercent(
  value: number | null,
  digits = 1
) {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return 'N/A'
  }

  const prefix =
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

function findPriceOnOrBefore(
  rows: PriceHistoryRow[],
  targetDate: string
) {
  for (
    let index =
      rows.length - 1;
    index >= 0;
    index--
  ) {
    if (
      rows[index]
        .price_date <=
      targetDate
    ) {
      return rows[index]
    }
  }

  return null
}

function calculateReturn(
  currentPrice: number,
  startPrice: number
) {
  if (startPrice <= 0) {
    return null
  }

  return (
    (
      currentPrice /
      startPrice -
      1
    ) *
    100
  )
}

function calculateCagr(
  currentPrice: number,
  startPrice: number,
  startDate: string,
  endDate: string
) {
  if (
    startPrice <= 0 ||
    currentPrice <= 0
  ) {
    return null
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
      millisecondsPerDay
    )

  if (years <= 0) {
    return null
  }

  return (
    (
      Math.pow(
        currentPrice /
          startPrice,
        1 / years
      ) -
      1
    ) *
    100
  )
}

function calculateMetrics(
  rows: PriceHistoryRow[]
): Metrics | null {
  if (
    rows.length === 0
  ) {
    return null
  }

  const latest =
    rows[
      rows.length - 1
    ]

  const latestDate =
    new Date(
      `${latest.price_date}T12:00:00Z`
    )

  const currentYear =
    latestDate
      .getUTCFullYear()

  const previousYearEnd =
    `${currentYear - 1}-12-31`

  const oneYearTarget =
    subtractYears(
      latest.price_date,
      1
    )

  const threeYearTarget =
    subtractYears(
      latest.price_date,
      3
    )

  const fiveYearTarget =
    subtractYears(
      latest.price_date,
      5
    )

  const ytdStart =
    findPriceOnOrBefore(
      rows,
      previousYearEnd
    )

  const oneYearStart =
    findPriceOnOrBefore(
      rows,
      oneYearTarget
    )

  const threeYearStart =
    findPriceOnOrBefore(
      rows,
      threeYearTarget
    )

  const fiveYearStart =
    findPriceOnOrBefore(
      rows,
      fiveYearTarget
    )

  let athRow =
    rows[0]

  for (
    const row of
    rows
  ) {
    if (
      row.close_price >
      athRow.close_price
    ) {
      athRow = row
    }
  }

  const drawdown =
    athRow.close_price > 0
      ? (
          latest.close_price /
            athRow.close_price -
          1
        ) *
        100
      : 0

  return {
    currentPrice:
      latest.close_price,

    currentDate:
      latest.price_date,

    ytd:
      ytdStart
        ? calculateReturn(
            latest.close_price,
            ytdStart
              .close_price
          )
        : null,

    oneYear:
      oneYearStart
        ? calculateReturn(
            latest.close_price,
            oneYearStart
              .close_price
          )
        : null,

    threeYearCagr:
      threeYearStart
        ? calculateCagr(
            latest.close_price,
            threeYearStart
              .close_price,
            threeYearStart
              .price_date,
            latest
              .price_date
          )
        : null,

    fiveYearCagr:
      fiveYearStart
        ? calculateCagr(
            latest.close_price,
            fiveYearStart
              .close_price,
            fiveYearStart
              .price_date,
            latest
              .price_date
          )
        : null,

    ath:
      athRow.close_price,

    athDate:
      athRow.price_date,

    drawdown,
  }
}

function metricTone(
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

export default function PriceHistory() {
  const [
    instruments,
    setInstruments,
  ] =
    useState<
      PriceInstrument[]
    >([])

  const [
    selectedInstrumentId,
    setSelectedInstrumentId,
  ] =
    useState('')

  const [
    history,
    setHistory,
  ] =
    useState<
      PriceHistoryRow[]
    >([])

  const [
    selectedRange,
    setSelectedRange,
  ] =
    useState<RangeOption>(
      '5Y'
    )

  const [
    loadingInstruments,
    setLoadingInstruments,
  ] =
    useState(true)

  const [
    loadingHistory,
    setLoadingHistory,
  ] =
    useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoadingInstruments(
          true
        )

        setErrorMessage('')

        const data =
          await getPriceInstruments()

        if (cancelled) {
          return
        }

        setInstruments(
          data
        )

        if (
          data.length > 0
        ) {
          setSelectedInstrumentId(
            data[0].id
          )
        }
      } catch (error) {
        console.error(
          'Price instruments:',
          error
        )

        if (!cancelled) {
          setErrorMessage(
            'Instrumenty se nepodařilo načíst.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingInstruments(
            false
          )
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (
      !selectedInstrumentId
    ) {
      return
    }

    let cancelled = false

    async function load() {
      try {
        setLoadingHistory(
          true
        )

        setErrorMessage('')

        const data =
          await getInstrumentPriceHistory(
            selectedInstrumentId
          )

        if (!cancelled) {
          setHistory(
            data
          )
        }
      } catch (error) {
        console.error(
          'Price history:',
          error
        )

        if (!cancelled) {
          setErrorMessage(
            'Historii cen se nepodařilo načíst.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(
            false
          )
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [
    selectedInstrumentId,
  ])

  const selectedInstrument =
    useMemo(
      () =>
        instruments.find(
          (instrument) =>
            instrument.id ===
            selectedInstrumentId
        ) ?? null,
      [
        instruments,
        selectedInstrumentId,
      ]
    )

  const metrics =
    useMemo(
      () =>
        calculateMetrics(
          history
        ),
      [history]
    )

  const chartData =
    useMemo(() => {
      if (
        history.length === 0
      ) {
        return []
      }

      if (
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
          latest.price_date,
          years
        )

      return history.filter(
        (row) =>
          row.price_date >=
          startDate
      )
    }, [
      history,
      selectedRange,
    ])

  const chartStats =
    useMemo(() => {
      if (
        chartData.length ===
        0
      ) {
        return {
          min: 0,
          max: 0,
        }
      }

      let min =
        chartData[0]
          .close_price

      let max =
        chartData[0]
          .close_price

      for (
        const row of
        chartData
      ) {
        min =
          Math.min(
            min,
            row.close_price
          )

        max =
          Math.max(
            max,
            row.close_price
          )
      }

      return {
        min,
        max,
      }
    }, [chartData])

  if (
    loadingInstruments
  ) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám historii cen...
        </div>
      </div>
    )
  }

  if (
    errorMessage &&
    instruments.length ===
      0
  ) {
    return (
      <div className="page">
        <div className="error-box">
          {errorMessage}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            Historie cen
          </h1>

          <p className="page-subtitle">
            Cenový vývoj a základní
            výkonnostní metriky
            jednotlivých instrumentů.
          </p>
        </div>

        <div
          style={{
            width:
              '300px',

            maxWidth:
              '100%',
          }}
        >
          <label className="form-label">
            Instrument
          </label>

          <select
            className="form-control"
            value={
              selectedInstrumentId
            }
            onChange={(event) =>
              setSelectedInstrumentId(
                event.target
                  .value
              )
            }
          >
            {instruments.map(
              (instrument) => (
                <option
                  key={
                    instrument.id
                  }
                  value={
                    instrument.id
                  }
                >
                  {
                    instrument.ticker
                  }
                  {'  ·  '}
                  {
                    instrument.name
                  }
                </option>
              )
            )}
          </select>
        </div>
      </header>

      {errorMessage && (
        <div
          className="error-box"
          style={{
            marginBottom:
              '18px',
          }}
        >
          {errorMessage}
        </div>
      )}

      {loadingHistory ? (
        <div className="loading-box">
          Načítám cenová data...
        </div>
      ) : (
        <>
          {metrics &&
          selectedInstrument ? (
            <>
              <section className="kpi-grid">
                <MetricCard
                  label="Aktuální cena"
                  value={formatPrice(
                    metrics
                      .currentPrice,
                    selectedInstrument
                      .currency
                  )}
                  description={formatDate(
                    metrics
                      .currentDate
                  )}
                />

                <MetricCard
                  label="YTD"
                  value={formatPercent(
                    metrics.ytd,
                    1
                  )}
                  description="Price return"
                  tone={metricTone(
                    metrics.ytd
                  )}
                />

                <MetricCard
                  label="1 rok"
                  value={formatPercent(
                    metrics.oneYear,
                    1
                  )}
                  description="Kumulativní výnos"
                  tone={metricTone(
                    metrics.oneYear
                  )}
                />

                <MetricCard
                  label="3Y CAGR"
                  value={formatPercent(
                    metrics
                      .threeYearCagr,
                    1
                  )}
                  description="Anualizovaný výnos"
                  tone={metricTone(
                    metrics
                      .threeYearCagr
                  )}
                />

                <MetricCard
                  label="5Y CAGR"
                  value={formatPercent(
                    metrics
                      .fiveYearCagr,
                    1
                  )}
                  description="Anualizovaný výnos"
                  tone={metricTone(
                    metrics
                      .fiveYearCagr
                  )}
                />

                <MetricCard
                  label="Historické maximum"
                  value={formatPrice(
                    metrics.ath,
                    selectedInstrument
                      .currency
                  )}
                  description={formatDate(
                    metrics.athDate
                  )}
                />

                <MetricCard
                  label="Drawdown"
                  value={formatPercent(
                    metrics
                      .drawdown,
                    1
                  )}
                  description="Od historického maxima"
                  tone={
                    metrics.drawdown <
                    0
                      ? 'negative'
                      : 'default'
                  }
                />

                <MetricCard
                  label="Datové body"
                  value={history.length.toLocaleString(
                    'cs-CZ'
                  )}
                  description="Dostupná historie"
                />
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      {
                        selectedInstrument
                          .ticker
                      }
                    </h2>

                    <div className="panel-subtitle">
                      {
                        selectedInstrument
                          .name
                      }
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
                  <div
                    style={{
                      display:
                        'flex',

                      justifyContent:
                        'space-between',

                      gap:
                        '20px',

                      flexWrap:
                        'wrap',

                      marginBottom:
                        '18px',

                      color:
                        'var(--text-muted)',

                      fontSize:
                        '12px',
                    }}
                  >
                    <span>
                      Minimum období:{' '}
                      <strong
                        style={{
                          color:
                            'var(--text-secondary)',
                        }}
                      >
                        {formatPrice(
                          chartStats.min,
                          selectedInstrument
                            .currency
                        )}
                      </strong>
                    </span>

                    <span>
                      Maximum období:{' '}
                      <strong
                        style={{
                          color:
                            'var(--text-secondary)',
                        }}
                      >
                        {formatPrice(
                          chartStats.max,
                          selectedInstrument
                            .currency
                        )}
                      </strong>
                    </span>

                    <span>
                      {
                        chartData.length
                      }
                      {' '}
                      bodů
                    </span>
                  </div>

                  <ResponsiveContainer
                    width="100%"
                    height={480}
                  >
                    <LineChart
                      data={
                        chartData
                      }
                      margin={{
                        top: 10,
                        right: 20,
                        bottom: 5,
                        left: 5,
                      }}
                    >
                      <CartesianGrid
                        stroke="#eef0f3"
                        vertical={
                          false
                        }
                      />

                      <XAxis
                        dataKey="price_date"
                        minTickGap={
                          45
                        }
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
                        tick={{
                          fill:
                            '#98a2b3',

                          fontSize:
                            11,
                        }}
                        axisLine={{
                          stroke:
                            '#e4e7ec',
                        }}
                        tickLine={
                          false
                        }
                      />

                      <YAxis
                        domain={[
                          'auto',
                          'auto',
                        ]}
                        width={70}
                        tickFormatter={(
                          value
                        ) =>
                          Number(
                            value
                          ).toLocaleString(
                            'cs-CZ',
                            {
                              maximumFractionDigits:
                                0,
                            }
                          )
                        }
                        tick={{
                          fill:
                            '#98a2b3',

                          fontSize:
                            11,
                        }}
                        axisLine={
                          false
                        }
                        tickLine={
                          false
                        }
                      />

                      <Tooltip
                        content={
                          <PriceTooltip
                            currency={
                              selectedInstrument
                                .currency
                            }
                          />
                        }
                      />

                      <Line
                        type="monotone"
                        dataKey="close_price"
                        stroke="#53657d"
                        strokeWidth={
                          2
                        }
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

                  <div
                    style={{
                      marginTop:
                        '15px',

                      paddingTop:
                        '14px',

                      borderTop:
                        '1px solid var(--border)',

                      color:
                        'var(--text-muted)',

                      fontSize:
                        '11px',

                      lineHeight:
                        1.5,
                    }}
                  >
                    Výnosové metriky
                    používají změnu ceny
                    instrumentu. Dividendy
                    nejsou v tomto pohledu
                    zahrnuté, proto jde o
                    price return, nikoliv
                    total return.
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="empty-box">
              Pro vybraný instrument
              nejsou dostupná historická
              cenová data.
            </div>
          )}
        </>
      )}
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
    <div
      style={{
        display: 'flex',

        padding:
          '3px',

        background:
          '#f2f4f7',

        border:
          '1px solid var(--border)',

        borderRadius:
          '6px',
      }}
    >
      {options.map(
        (option) => {
          const active =
            value === option

          return (
            <button
              key={
                option
              }
              onClick={() =>
                onChange(
                  option
                )
              }
              style={{
                minWidth:
                  '48px',

                padding:
                  '6px 10px',

                color:
                  active
                    ? 'var(--text)'
                    : 'var(--text-secondary)',

                background:
                  active
                    ? 'white'
                    : 'transparent',

                border:
                  active
                    ? '1px solid var(--border-strong)'
                    : '1px solid transparent',

                borderRadius:
                  '4px',

                cursor:
                  'pointer',

                fontSize:
                  '12px',

                fontWeight:
                  active
                    ? 600
                    : 500,

                boxShadow:
                  active
                    ? '0 1px 2px rgba(16,24,40,0.04)'
                    : 'none',
              }}
            >
              {option}
            </button>
          )
        }
      )}
    </div>
  )
}

function PriceTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean

  payload?: Array<{
    value?: number
  }>

  label?: string

  currency:
    | string
    | null
}) {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null
  }

  const price =
    Number(
      payload[0].value
    )

  return (
    <div
      style={{
        padding:
          '10px 12px',

        background:
          '#ffffff',

        border:
          '1px solid #d0d5dd',

        borderRadius:
          '6px',

        boxShadow:
          '0 4px 12px rgba(16,24,40,0.08)',
      }}
    >
      <div
        style={{
          marginBottom:
            '5px',

          color:
            'var(--text-muted)',

          fontSize:
            '11px',
        }}
      >
        {label
          ? formatDate(
              label
            )
          : ''}
      </div>

      <div
        style={{
          color:
            'var(--text)',

          fontSize:
            '13px',

          fontWeight:
            600,

          fontVariantNumeric:
            'tabular-nums',
        }}
      >
        {formatPrice(
          price,
          currency
        )}
      </div>
    </div>
  )
}