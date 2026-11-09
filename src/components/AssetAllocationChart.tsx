import { useEffect, useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import { getAllocation } from '../services/allocation'

type AllocationItem = {
  name: string
  value: number
  percentage?: string
}

const COLORS = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ef4444',
  '#64748b',
]

export default function AssetAllocationChart() {
  const [data, setData] = useState<
    AllocationItem[]
  >([])

  useEffect(() => {
    async function load() {
      const allocation =
        await getAllocation()

      const total = allocation.reduce(
        (
          sum: number,
          item: AllocationItem
        ) =>
          sum +
          Math.abs(Number(item.value)),
        0
      )

      const formatted =
        allocation.map(
          (item: AllocationItem) => ({
            ...item,
            percentage:
              total > 0
                ? (
                    (Math.abs(
                      Number(item.value)
                    ) /
                      total) *
                    100
                  ).toFixed(1)
                : '0',
          })
        )

      setData(formatted)
    }

    load()
  }, [])

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
      }}
    >
      <h3>Asset Allocation</h3>

      <div
        style={{
          width: '100%',
          height: '450px',
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius={130}
            >
              {data.map(
                (_entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      COLORS[
                        index %
                          COLORS.length
                      ]
                    }
                  />
                )
              )}
            </Pie>

            <Tooltip
              formatter={(value) => {
                return [
                  `${Number(
                    value
                  ).toLocaleString(
                    'cs-CZ'
                  )} Kč`,
                  'Hodnota',
                ]
              }}
            />

            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          marginTop: '20px',
        }}
      >
        {data.map((item) => (
          <div
            key={item.name}
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              borderBottom:
                '1px solid #eee',
              padding: '6px 0',
            }}
          >
            <strong>{item.name}</strong>

            <span>
              {Number(
                item.value
              ).toLocaleString(
                'cs-CZ'
              )}{' '}
              Kč ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}