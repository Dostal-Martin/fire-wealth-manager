import { useEffect, useState } from 'react'

import { getMarketInstruments } from '../services/marketData'

export default function MarketData() {
  const [instruments, setInstruments] =
    useState<any[]>([])

  const [message, setMessage] =
    useState('')

  useEffect(() => {
    async function load() {
      const data =
        await getMarketInstruments()

      setInstruments(data)
    }

    load()
  }, [])

  async function handleRefreshInstruments() {
    try {
      const data = await getMarketInstruments()

      setInstruments(data)
      setMessage(`Načteno ${data.length} instrumentů`)
    } catch (error) {
      console.error(error)

      setMessage('Načítání instrumentů selhalo')
    }
  }

  return (
    <div>
      <h1>📊 Tržní data</h1>

      <button
        onClick={handleRefreshInstruments}
        style={{
          padding: '12px 20px',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '20px',
        }}
      >
        Obnovit seznam instrumentů
      </button>

      <p>{message}</p>

      <p>
        Instrumentů s veřejným
        tickerem: {instruments.length}
      </p>

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
            <th>Ticker</th>
            <th>Název</th>
            <th>Typ</th>
            <th>Cena</th>
          </tr>
        </thead>

        <tbody>
          {instruments.map(
            (instrument) => (
              <tr
                key={instrument.id}
                style={{
                  borderBottom:
                    '1px solid #ddd',
                }}
              >
                <td>
                  {instrument.ticker}
                </td>

                <td>
                  {instrument.name}
                </td>

                <td>
                  {
                    instrument.asset_type
                  }
                </td>

                <td>-</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}