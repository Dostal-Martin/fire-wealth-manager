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

function formatPrice(
  value: number,
  currency: string | null
) {
  return `${value.toLocaleString(
    'cs-CZ',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )} ${currency ?? ''}`.trim()
}

function formatPercent(
  value: number | null
) {
  if (value === null) {
    return 'N/A'
  }

  const prefix =
    value > 0 ? '+' : ''

  return `${prefix}${value.toLocaleString(
    'cs-CZ',
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
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
    date.getUTCFullYear() - years
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
      rows[index].price_date <=
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
  if (
    !Number.isFinite(startPrice) ||
    startPrice <= 0
  ) {
    return null
  }

  return (
    (currentPrice / startPrice - 1) *
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
    !Number.isFinite(startPrice) ||
    startPrice <= 0
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
        currentPrice / startPrice,
        1 / years
      ) - 1
    ) * 100
  )
}

function calculateMetrics(
  rows: PriceHistoryRow[]
): Metrics | null {
  if (rows.length === 0) {
    return null
  }

  const latest =
    rows[rows.length - 1]

  const latestDate =
    new Date(
      `${latest.price_date}T12:00:00Z`
    )

  const year =
    latestDate.getUTCFullYear()

  const previousYearEnd =
    `${year - 1}-12-31`

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

  let athRow = rows[0]

  for (const row of rows) {
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
        ) * 100
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
            ytdStart.close_price
          )
        : null,

    oneYear:
      oneYearStart
        ? calculateReturn(
            latest.close_price,
            oneYearStart.close_price
          )
        : null,

    threeYearCagr:
      threeYearStart
        ? calculateCagr(
            latest.close_price,
            threeYearStart.close_price,
            threeYearStart.price_date,
            latest.price_date
          )
        : null,

    fiveYearCagr:
      fiveYearStart
        ? calculateCagr(
            latest.close_price,
            fiveYearStart.close_price,
            fiveYearStart.price_date,
            latest.price_date
          )
        : null,

    ath:
      athRow.close_price,

    athDate:
      athRow.price_date,

    drawdown,
  }
}

export default function PriceHistory() {
  const [
    instruments,
    setInstruments,
  ] = useState<PriceInstrument[]>([])

  const [
    selectedInstrumentId,
    setSelectedInstrumentId,
  ] = useState('')

  const [
    history,
    setHistory,
  ] = useState<PriceHistoryRow[]>([])

  const [
    selectedRange,
    setSelectedRange,
  ] = useState<RangeOption>('5Y')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  useEffect(() => {
    async function loadInstruments() {
      try {
        setLoading(true)

        const data =
          await getPriceInstruments()

        setInstruments(data)

        if (data.length > 0) {
          setSelectedInstrumentId(
            data[0].id
          )
        }
      } catch (error) {
        console.error(error)

        setErrorMessage(
          'Nepodařilo se načíst instrumenty.'
        )
      } finally {
        setLoading(false)
      }
    }

    loadInstruments()
  }, [])

  useEffect(() => {
    if (!selectedInstrumentId) {
      return
    }

    async function loadHistory() {
      try {
        setLoading(true)
        setErrorMessage('')

        const data =
          await getInstrumentPriceHistory(
            selectedInstrumentId
          )

        setHistory(data)
      } catch (error) {
        console.error(error)

        setErrorMessage(
          'Nepodařilo se načíst historii cen.'
        )
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [selectedInstrumentId])

  const selectedInstrument =
    instruments.find(
      (instrument) =>
        instrument.id ===
        selectedInstrumentId
    ) ?? null

  const metrics =
    useMemo(
      () =>
        calculateMetrics(history),
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
        selectedRange === 'MAX'
      ) {
        return history
      }

      const latest =
        history[
          history.length - 1
        ]

      const years =
        selectedRange === '1Y'
          ? 1
          : selectedRange === '3Y'
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

  if (
    loading &&
    instruments.length === 0
  ) {
    return (
      <div>
        Načítám historii cen...
      </div>
    )
  }

  return (
    <div>
      <h1>📉 Historie cen</h1>

      <div
        style={{
          display: 'flex',
          gap: '15px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '25px',
        }}
      >
        <label>
          <strong>
            Instrument:
          </strong>
        </label>

        <select
          value={
            selectedInstrumentId
          }
          onChange={(event) =>
            setSelectedInstrumentId(
              event.target.value
            )
          }
          style={{
            minWidth: '280px',
            padding: '10px',
            border:
              '1px solid #cbd5e1',
            borderRadius: '8px',
            background: 'white',
          }}
        >
          {instruments.map(
            (instrument) => (
              <option
                key={instrument.id}
                value={instrument.id}
              >
                {instrument.ticker}
                {' | '}
                {instrument.name}
              </option>
            )
          )}
        </select>

        <span
          style={{
            color: '#64748b',
          }}
        >
          {history.length.toLocaleString(
            'cs-CZ'
          )}{' '}
          cenových bodů
        </span>
      </div>

      {errorMessage && (
        <p
          style={{
            color: '#dc2626',
            fontWeight: 600,
          }}
        >
          {errorMessage}
        </p>
      )}

      {metrics &&
        selectedInstrument && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(190px, 1fr))',
                gap: '16px',
                marginBottom: '25px',
              }}
            >
              <MetricCard
                title="Aktuální cena"
                value={formatPrice(
                  metrics.currentPrice,
                  selectedInstrument.currency
                )}
                subtitle={
                  metrics.currentDate
                }
              />

              <MetricCard
                title="YTD"
                value={formatPercent(
                  metrics.ytd
                )}
                valueColor={
                  metrics.ytd !==
                    null &&
                  metrics.ytd < 0
                    ? '#dc2626'
                    : '#16a34a'
                }
              />

              <MetricCard
                title="1 rok"
                value={formatPercent(
                  metrics.oneYear
                )}
                valueColor={
                  metrics.oneYear !==
                    null &&
                  metrics.oneYear < 0
                    ? '#dc2626'
                    : '#16a34a'
                }
              />

              <MetricCard
                title="3Y CAGR"
                value={formatPercent(
                  metrics.threeYearCagr
                )}
                valueColor={
                  metrics.threeYearCagr !==
                    null &&
                  metrics.threeYearCagr <
                    0
                    ? '#dc2626'
                    : '#16a34a'
                }
              />

              <MetricCard
                title="5Y CAGR"
                value={formatPercent(
                  metrics.fiveYearCagr
                )}
                valueColor={
                  metrics.fiveYearCagr !==
                    null &&
                  metrics.fiveYearCagr <
                    0
                    ? '#dc2626'
                    : '#16a34a'
                }
              />

              <MetricCard
                title="ATH"
                value={formatPrice(
                  metrics.ath,
                  selectedInstrument.currency
                )}
                subtitle={
                  metrics.athDate
                }
              />

              <MetricCard
                title="Drawdown"
                value={formatPercent(
                  metrics.drawdown
                )}
                valueColor={
                  metrics.drawdown < 0
                    ? '#dc2626'
                    : '#16a34a'
                }
              />
            </div>

            <div
              style={{
                background: 'white',
                border:
                  '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems: 'center',
                  gap: '15px',
                  flexWrap: 'wrap',
                  marginBottom: '20px',
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                    }}
                  >
                    {
                      selectedInstrument.ticker
                    }
                  </h2>

                  <p
                    style={{
                      margin:
                        '5px 0 0',
                      color: '#64748b',
                    }}
                  >
                    {
                      selectedInstrument.name
                    }
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                  }}
                >
                  {(
                    [
                      '1Y',
                      '3Y',
                      '5Y',
                      'MAX',
                    ] as RangeOption[]
                  ).map(
                    (range) => (
                      <button
                        key={range}
                        onClick={() =>
                          setSelectedRange(
                            range
                          )
                        }
                        style={{
                          padding:
                            '8px 14px',
                          border:
                            '1px solid #cbd5e1',
                          borderRadius:
                            '8px',
                          cursor:
                            'pointer',
                          background:
                            selectedRange ===
                            range
                              ? '#2563eb'
                              : 'white',
                          color:
                            selectedRange ===
                            range
                              ? 'white'
                              : '#0f172a',
                        }}
                      >
                        {range}
                      </button>
                    )
                  )}
                </div>
              </div>

              <ResponsiveContainer
                width="100%"
                height={480}
              >
                <LineChart
                  data={chartData}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="price_date"
                    minTickGap={40}
                    tick={{
                      fontSize: 12,
                    }}
                  />

                  <YAxis
                    domain={[
                      'auto',
                      'auto',
                    ]}
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
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      formatPrice(
                        Number(value),
                        selectedInstrument.currency
                      ),
                      'Cena',
                    ]}
                    labelFormatter={(
                      label
                    ) =>
                      `Datum: ${label}`
                    }
                  />

                  <Line
                    type="monotone"
                    dataKey="close_price"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 5,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

      {!loading &&
        history.length === 0 && (
          <div>
            Pro vybraný instrument
            nejsou dostupná cenová
            data.
          </div>
        )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  valueColor = '#0f172a',
}: {
  title: string
  value: string
  subtitle?: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        background: 'white',
        border:
          '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px',
      }}
    >
      <div
        style={{
          color: '#64748b',
          fontSize: '14px',
          marginBottom: '8px',
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: valueColor,
          fontSize: '22px',
          fontWeight: 700,
        }}
      >
        {value}
      </div>

      {subtitle && (
        <div
          style={{
            color: '#94a3b8',
            fontSize: '12px',
            marginTop: '6px',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  )
}