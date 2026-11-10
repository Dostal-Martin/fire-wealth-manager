import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

import {
  getAllocation,
} from '../services/allocation'

type AllocationRow = {
  name: string
  value: number
}

type ViewRow =
  AllocationRow & {
    share: number
    color: string
  }

const COLORS = [
  '#46566d',
  '#68768a',
  '#8793a2',
  '#a2acb8',
  '#bcc3cc',
  '#d2d7dd',
  '#8b8377',
  '#aaa297',
]

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

  if (absolute >= 1_000_000) {
    return `${(
      value / 1_000_000
    ).toLocaleString(
      'cs-CZ',
      {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }
    )} mil. Kč`
  }

  if (absolute >= 1_000) {
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

export default function AssetAllocationChart() {
  const [
    allocation,
    setAllocation,
  ] =
    useState<AllocationRow[]>([])

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

        const data =
          await getAllocation()

        if (!cancelled) {
          setAllocation(
            data as AllocationRow[]
          )
        }
      } catch (error) {
        console.error(
          'Asset allocation:',
          error
        )

        if (!cancelled) {
          setErrorMessage(
            'Alokaci se nepodařilo načíst.'
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

  const netWorth =
    useMemo(
      () =>
        allocation.reduce(
          (sum, row) =>
            sum +
            Number(row.value),
          0
        ),
      [allocation]
    )

  const assets =
    useMemo(
      () =>
        allocation
          .filter(
            (row) =>
              Number(row.value) >
              0
          )
          .reduce(
            (sum, row) =>
              sum +
              Number(row.value),
            0
          ),
      [allocation]
    )

  const rows =
    useMemo<ViewRow[]>(() => {
      return allocation
        .map(
          (row, index) => {
            const value =
              Number(row.value)

            return {
              name: row.name,
              value,

              share:
                netWorth !== 0
                  ? (
                      value /
                      netWorth
                    ) * 100
                  : 0,

              color:
                COLORS[
                  index %
                  COLORS.length
                ],
            }
          }
        )
        .sort(
          (a, b) => {
            if (
              a.value < 0 &&
              b.value >= 0
            ) {
              return 1
            }

            if (
              a.value >= 0 &&
              b.value < 0
            ) {
              return -1
            }

            return (
              b.value -
              a.value
            )
          }
        )
    }, [
      allocation,
      netWorth,
    ])

  const chartRows =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.value > 0
        ),
      [rows]
    )

  if (loading) {
    return (
      <div className="allocation-state">
        Načítám alokaci...
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="error-box">
        {errorMessage}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="empty-box">
        Nejsou dostupná data
        pro alokaci.
      </div>
    )
  }

  return (
    <div className="allocation-compact">
      <div className="allocation-compact-chart">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <PieChart>
            <Pie
              data={chartRows}
              dataKey="value"
              nameKey="name"

              cx="50%"
              cy="50%"

              innerRadius="63%"
              outerRadius="86%"

              paddingAngle={1}

              stroke="#ffffff"
              strokeWidth={2}
            >
              {chartRows.map(
                (row) => (
                  <Cell
                    key={row.name}
                    fill={row.color}
                  />
                )
              )}
            </Pie>

            <Tooltip
              content={
                <AllocationTooltip />
              }
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="allocation-compact-center">
          <div className="allocation-compact-center-label">
            Čisté jmění
          </div>

          <div className="allocation-compact-center-value">
            {formatCompactMoney(
              netWorth
            )}
          </div>
        </div>
      </div>

      <div className="allocation-compact-right">
        <div className="allocation-compact-header">
          <div>
            Třída aktiv
          </div>

          <div>
            Podíl
          </div>

          <div>
            Hodnota
          </div>
        </div>

        {rows.map(
          (row) => {
            const negative =
              row.value < 0

            return (
              <div
                key={row.name}
                className={
                  negative
                    ? 'allocation-compact-row allocation-compact-row-negative'
                    : 'allocation-compact-row'
                }
              >
                <div className="allocation-compact-name">
                  <span
                    className="allocation-compact-dot"
                    style={{
                      background:
                        row.color,
                    }}
                  />

                  <span>
                    {row.name}
                  </span>
                </div>

                <div
                  className={
                    negative
                      ? 'allocation-compact-share allocation-negative'
                      : 'allocation-compact-share'
                  }
                >
                  {row.share.toLocaleString(
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

                <div
                  className={
                    negative
                      ? 'allocation-compact-value allocation-negative'
                      : 'allocation-compact-value'
                  }
                >
                  {formatCompactMoney(
                    row.value
                  )}
                </div>
              </div>
            )
          }
        )}

        <div className="allocation-compact-footer">
          <span>
            Aktiva celkem
          </span>

          <strong>
            {formatCompactMoney(
              assets
            )}
          </strong>
        </div>
      </div>
    </div>
  )
}

function AllocationTooltip({
  active,
  payload,
}: {
  active?: boolean

  payload?: Array<{
    name?: string
    value?: number

    payload?: {
      share?: number
    }
  }>
}) {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null
  }

  const item =
    payload[0]

  const value =
    Number(
      item.value ??
      0
    )

  const share =
    Number(
      item.payload
        ?.share ??
      0
    )

  return (
    <div className="allocation-tooltip">
      <div className="allocation-tooltip-name">
        {item.name ??
          'Aktivum'}
      </div>

      <div className="allocation-tooltip-row">
        <span>
          Podíl
        </span>

        <strong>
          {share.toLocaleString(
            'cs-CZ',
            {
              minimumFractionDigits:
                1,

              maximumFractionDigits:
                1,
            }
          )}
          {' %'}
        </strong>
      </div>

      <div className="allocation-tooltip-row">
        <span>
          Hodnota
        </span>

        <strong>
          {formatMoney(
            value
          )}
        </strong>
      </div>
    </div>
  )
}