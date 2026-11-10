import { useEffect, useState } from 'react'

import { getPriceHistory } from '../services/priceHistory'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

export default function PriceHistory() {
  const [rows, setRows] =
    useState<any[]>([])

  useEffect(() => {
    async function load() {
      const data =
        await getPriceHistory()

      setRows(data.reverse())
    }

    load()
  }, [])

  return (
    <div>
      <h1>📉 Historie cen</h1>

      <p>
        Záznamů: {rows.length}
      </p>

      <div
        style={{
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '30px',
        }}
      >
        <ResponsiveContainer
          width="100%"
          height={400}
        >
          <LineChart data={rows}>
            <CartesianGrid
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="price_date"
            />

            <YAxis />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="close_price"
              stroke="#2563eb"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table
        style={{
          width: '100%',
          background: 'white',
        }}
      >
        <thead>
          <tr>
            <th>Datum</th>
            <th>Cena</th>
            <th>Zdroj</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.price_date}
              </td>

              <td>
                {row.close_price}
              </td>

              <td>{row.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}