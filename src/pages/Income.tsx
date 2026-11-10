import { useEffect, useState } from 'react'

import { getIncomeStats } from '../services/income'

export default function Income() {
  const [data, setData] =
    useState<any>(null)

  useEffect(() => {
    async function load() {
      const stats =
        await getIncomeStats()

      setData(stats)
    }

    load()
  }, [])

  if (!data) {
    return <div>Načítám...</div>
  }

  return (
    <div>
      <h1>📈 Příjmy</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(3, 280px)',
          gap: '20px',
          marginBottom: '30px',
        }}
      >
        <Card
          title="Dividendy"
          value={`${Math.round(
            data.dividendTotal
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Kupóny"
          value={`${Math.round(
            data.couponTotal
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Pasivní příjem"
          value={`${Math.round(
            data.passiveIncome
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
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
        <h2>Příjmy podle let</h2>

        <table
          style={{
            width: '100%',
          }}
        >
          <thead>
            <tr>
              <th>Rok</th>
              <th>Dividendy</th>
              <th>Kupóny</th>
              <th>Celkem</th>
            </tr>
          </thead>

          <tbody>
            {data.yearlyIncome.map(
              (row: any) => (
                <tr key={row.year}>
                  <td>{row.year}</td>

                  <td>
                    {Math.round(
                      row.dividends
                    ).toLocaleString(
                      'cs-CZ'
                    )}{' '}
                    Kč
                  </td>

                  <td>
                    {Math.round(
                      row.coupons
                    ).toLocaleString(
                      'cs-CZ'
                    )}{' '}
                    Kč
                  </td>

                  <td>
                    {Math.round(
                      row.total
                    ).toLocaleString(
                      'cs-CZ'
                    )}{' '}
                    Kč
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Card({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        background: 'white',
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