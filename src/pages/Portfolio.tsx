import { useEffect, useState } from 'react'
import { getPortfolioPositions } from '../services/portfolio'

export default function Portfolio() {
  const [positions, setPositions] =
    useState<any[]>([])

  useEffect(() => {
    async function load() {
      const data =
        await getPortfolioPositions()

      setPositions(data)
    }

    load()
  }, [])

  const totalPortfolioValue =
    positions.reduce(
      (sum, position) =>
        sum + Number(position.current_value),
      0
    )

  return (
    <div>
      <h1>Portfolio</h1>

      <p>
        Počet pozic: {positions.length}
      </p>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '20px',
        }}
      >
        <thead>
          <tr>
            <th>Název</th>
            <th>Typ</th>
            <th>Podíl</th>
            <th>Náklady</th>
            <th>Hodnota</th>
            <th>Zisk</th>
            <th>Výnos</th>
          </tr>
        </thead>

        <tbody>
          {positions.map((position) => {
            const cost =
              Number(position.total_cost)

            const value =
              Number(position.current_value)

            const profit =
              value - cost

            const profitPct =
              cost > 0
                ? (
                    (profit / cost) *
                    100
                  ).toFixed(1)
                : '0'

            const weight =
              totalPortfolioValue > 0
                ? (
                    (value /
                      totalPortfolioValue) *
                    100
                  ).toFixed(1)
                : '0'

            return (
              <tr
                key={position.id}
                style={{
                  borderBottom:
                    '1px solid #ddd',
                }}
              >
                <td>
                  {
                    position.instruments
                      ?.name
                  }
                </td>

                <td>
                  {
                    position.instruments
                      ?.asset_type
                  }
                </td>

                <td>{weight}%</td>

                <td>
                  {cost.toLocaleString(
                    'cs-CZ'
                  )}{' '}
                  Kč
                </td>

                <td>
                  {value.toLocaleString(
                    'cs-CZ'
                  )}{' '}
                  Kč
                </td>

                <td
                  style={{
                    color:
                      profit >= 0
                        ? '#16a34a'
                        : '#dc2626',
                    fontWeight: 600,
                  }}
                >
                  {profit.toLocaleString(
                    'cs-CZ'
                  )}{' '}
                  Kč
                </td>

                <td
                  style={{
                    color:
                      profit >= 0
                        ? '#16a34a'
                        : '#dc2626',
                    fontWeight: 600,
                  }}
                >
                  {profitPct} %
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}