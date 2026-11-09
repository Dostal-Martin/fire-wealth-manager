import { useEffect, useState } from 'react'
import { getInstrumentCount } from '../services/dashboard'

export default function Dashboard() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    async function load() {
      const value = await getInstrumentCount()
      setCount(value)
    }

    load()
  }, [])

  return (
    <div>
      <h1>Dashboard</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: '20px',
          marginTop: '20px',
        }}
      >
        <div>
          <h3>Instrumenty</h3>
          <p>{count}</p>
        </div>
      </div>
    </div>
  )
}