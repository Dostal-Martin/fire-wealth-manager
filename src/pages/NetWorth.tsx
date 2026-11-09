import { getHistory } from '../services/history'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

export default function NetWorth() {
  const history = getHistory()

  const startValue =
    history[0].amount

  const endValue =
    history[history.length - 1]
      .amount

  const startDate = new Date(
    history[0].date
  )

  const endDate = new Date(
    history[history.length - 1].date
  )

  const years =
    (endDate.getTime() -
      startDate.getTime()) /
    (365.25 *
      24 *
      60 *
      60 *
      1000)

  const cagr =
    (
      Math.pow(
        endValue / startValue,
        1 / years
      ) - 1
    ) * 100

  const growth =
    endValue - startValue

  return (
    <div>
      <h1>📈 Vývoj majetku</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(4, 1fr)',
          gap: '20px',
          marginBottom: '30px',
        }}
      >
        <MetricCard
          title="Počáteční majetek"
          value={`${Math.round(
            startValue
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <MetricCard
          title="Aktuální majetek"
          value={`${Math.round(
            endValue
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <MetricCard
          title="Celkový růst"
          value={`${Math.round(
            growth
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <MetricCard
          title="CAGR"
          value={`${cagr.toFixed(
            1
          )} % p.a.`}
        />
      </div>

      <div
        style={{
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <ResponsiveContainer
          width="100%"
          height={550}
        >
          <LineChart data={history}>
            <CartesianGrid
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="date"
            />

            <YAxis
              tickFormatter={(value) =>
                `${(
                  value / 1000000
                ).toFixed(0)}M`
              }
            />

            <Tooltip
              formatter={(value) => [
                `${Math.round(
                  Number(value)
                ).toLocaleString(
                  'cs-CZ'
                )} Kč`,
                'Majetek',
              ]}
            />

            <Line
              type="monotone"
              dataKey="amount"
              stroke="#2563eb"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
      }}
    >
      <h3>{title}</h3>

      <p
        style={{
          fontSize: '22px',
          fontWeight: 600,
        }}
      >
        {value}
      </p>
    </div>
  )
}