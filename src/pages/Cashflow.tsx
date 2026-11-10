import { useEffect, useState } from 'react'

import { getCashflows } from '../services/cashflowManager'

export default function Cashflow() {
  const [cashflows, setCashflows] =
    useState<any[]>([])

  useEffect(() => {
    async function load() {
      const data =
        await getCashflows()

      setCashflows(data)
    }

    load()
  }, [])

  return (
    <div>
      <h1>💰 Cashflow</h1>

      <p>
        Počet transakcí:
        {' '}
        {cashflows.length}
      </p>

      <table
        style={{
          width: '100%',
          background: 'white',
        }}
      >
        <thead>
          <tr>
            <th>Datum</th>
            <th>Typ</th>
            <th>Instrument</th>
            <th>Částka CZK</th>
          </tr>
        </thead>

        <tbody>
          {cashflows.map(
            (row) => (
              <tr key={row.id}>
                <td>
                  {row.transaction_date}
                </td>

                <td>
                  {row.transaction_type}
                </td>

                <td>
                  {
                    row.instruments
                      ?.name
                  }
                </td>

                <td>
                  {Math.round(
                    Number(
                      row.amount_czk
                    )
                  ).toLocaleString(
                    'cs-CZ'
                  )}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}