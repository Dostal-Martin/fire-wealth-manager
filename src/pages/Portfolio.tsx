import { useEffect, useState } from 'react'

import { getPortfolioPositions } from '../services/portfolio'
import InstrumentDetail from './InstrumentDetail'

export default function Portfolio() {
  const [positions, setPositions] =
    useState<any[]>([])

  const [
    selectedPosition,
    setSelectedPosition,
  ] = useState<any | null>(null)

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
        sum +
        Number(position.current_value),
      0
    )

  return (
    <div>
      <h1>Portfolio</h1>

      <p>
        Počet pozic:{' '}
        {positions.length}
      </p>

      {selectedPosition && (
        <InstrumentDetail
          position={selectedPosition}
          onClose={() =>
            setSelectedPosition(null)
          }
        />
      )}

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '20px',
          background: 'white',
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
          {positions.map(
            (position) => {
              const cost =
                Number(
                  position.total_cost
                )

              const value =
                Number(
                  position.current_value
                )

              const profit =
                value - cost

              const profitPct =
                cost > 0
                  ? (
                      (profit /
                        cost) *
                      100
                    ).toFixed(1)
                  : '0'

              const weight =
                totalPortfolioValue >
                0
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
                    <button
                      onClick={() =>
                        setSelectedPosition(
                          position
                        )
                      }
                      style={{
                        border:
                          'none',
                        background:
                          'none',
                        color:
                          '#2563eb',
                        cursor:
                          'pointer',
                        fontWeight:
                          600,
                      }}
                    >
                      {
                        position
                          .instruments
                          ?.name
                      }
                    </button>
                  </td>

                  <td>
                    {
                      position
                        .instruments
                        ?.asset_type
                    }
                  </td>

                  <td>
                    {weight} %
                  </td>

                  <td>
                    {Math.round(
                      cost
                    ).toLocaleString(
                      'cs-CZ'
                    )}{' '}
                    Kč
                  </td>

                  <td>
                    {Math.round(
                      value
                    ).toLocaleString(
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
                    {Math.round(
                      profit
                    ).toLocaleString(
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
            }
          )}
        </tbody>
      </table>
    </div>
  )
}