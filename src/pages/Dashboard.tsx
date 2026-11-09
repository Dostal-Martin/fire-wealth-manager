import { useEffect, useState } from 'react'
import { getInstrumentCount } from '../services/dashboard'
import { getPortfolioStats } from '../services/positions'

export default function Dashboard() {
  const [instrumentCount, setInstrumentCount] = useState(0)

  const [portfolioValue, setPortfolioValue] =
    useState(0)

  const [investedValue, setInvestedValue] =
    useState(0)

  const [profit, setProfit] = useState(0)

  const [positionCount, setPositionCount] =
    useState(0)

  useEffect(() => {
    async function load() {
      const instruments =
        await getInstrumentCount()

      const stats =
        await getPortfolioStats()

      setInstrumentCount(instruments)
      setPortfolioValue(stats.portfolioValue)
      setInvestedValue(stats.investedValue)
      setProfit(stats.profit)
      setPositionCount(stats.positionCount)
    }

    load()
  }, [])

  return (
    <div>
      <h1>Dashboard</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(2, 250px)',
          gap: '20px',
          marginTop: '20px',
        }}
      >
        <Card
          title="Instrumenty"
          value={instrumentCount.toString()}
        />

        <Card
          title="Portfolio"
          value={`${portfolioValue.toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Investováno"
          value={`${investedValue.toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Zisk"
          value={`${profit.toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Pozice"
          value={positionCount.toString()}
        />
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
        padding: '20px',
      }}
    >
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  )
}