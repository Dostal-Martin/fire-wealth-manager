import { useEffect, useState } from 'react'
import { getInstruments } from '../services/instruments'

export default function Portfolio() {
  const [instruments, setInstruments] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const data = await getInstruments()
      setInstruments(data)
    }

    load()
  }, [])

  return (
    <div>
      <h1>Portfolio</h1>

      <p>Počet instrumentů: {instruments.length}</p>

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
            <th>Ticker</th>
            <th>Typ</th>
            <th>Měna</th>
          </tr>
        </thead>

        <tbody>
          {instruments.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.ticker ?? '-'}</td>
              <td>{item.asset_type}</td>
              <td>{item.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
