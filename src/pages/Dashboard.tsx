import { useEffect, useState } from 'react'

import { getInstrumentCount } from '../services/dashboard'
import { getPortfolioStats } from '../services/positions'
import { getXirr } from '../services/xirr'
import { getFireMetrics } from '../services/fire'
import { getTopPositions } from '../services/topPositions'
import { getNetWorthStats } from '../services/netWorthStats'

import AssetAllocationChart from '../components/AssetAllocationChart'

export default function Dashboard() {
  const [instrumentCount, setInstrumentCount] =
    useState(0)

  const [portfolioValue, setPortfolioValue] =
    useState(0)

  const [investedValue, setInvestedValue] =
    useState(0)

  const [profit, setProfit] =
    useState(0)

  const [positionCount, setPositionCount] =
    useState(0)

  const [xirr, setXirr] =
    useState(0)

  const [fireProgress, setFireProgress] =
    useState(0)

  const [fireEta, setFireEta] =
    useState('')

  const [topPositions, setTopPositions] =
    useState<any[]>([])

  const [ath, setAth] =
    useState(0)

  const [drawdown, setDrawdown] =
    useState(0)

  const [cagr, setCagr] =
    useState(0)

  useEffect(() => {
    async function load() {
      const instruments =
        await getInstrumentCount()

      const stats =
        await getPortfolioStats()

      const xirrValue =
        await getXirr()

      const fire =
        getFireMetrics()

      const top =
        await getTopPositions()

      const nw =
        getNetWorthStats()

      setInstrumentCount(
        instruments
      )

      setPortfolioValue(
        stats.portfolioValue
      )

      setInvestedValue(
        stats.investedValue
      )

      setProfit(stats.profit)

      setPositionCount(
        stats.positionCount
      )

      setXirr(xirrValue)

      setFireProgress(
        fire.progress
      )

      setFireEta(
        fire.estimatedDate
          .toLocaleDateString('cs-CZ', {
            month: 'long',
            year: 'numeric',
          })
      )

      setTopPositions(top)

      setAth(nw.ath)

      setDrawdown(nw.drawdown)

      setCagr(
        nw.cagrSinceStart
      )
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
            'repeat(4, 250px)',
          gap: '20px',
          marginBottom: '40px',
        }}
      >
        <Card
          title="Portfolio"
          value={`${Math.round(
            portfolioValue
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Investováno"
          value={`${Math.round(
            investedValue
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Zisk"
          value={`${Math.round(
            profit
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="XIRR"
          value={`${xirr.toFixed(
            2
          )} %`}
        />

        <Card
          title="CAGR"
          value={`${cagr.toFixed(
            1
          )} %`}
        />

        <Card
          title="ATH"
          value={`${Math.round(
            ath
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Drawdown"
          value={`${drawdown.toFixed(
            1
          )} %`}
        />

        <Card
          title="FIRE Progress"
          value={`${fireProgress.toFixed(
            1
          )} %`}
        />

        <Card
          title="FIRE ETA"
          value={fireEta}
        />

        <Card
          title="Pozice"
          value={positionCount.toString()}
        />

        <Card
          title="Instrumenty"
          value={instrumentCount.toString()}
        />
      </div>

      <AssetAllocationChart />

      <div
        style={{
          marginTop: '40px',
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <h2>Top 5 pozic</h2>

        {topPositions.map(
          (
            position,
            index
          ) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                padding: '8px 0',
                borderBottom:
                  '1px solid #eee',
              }}
            >
              <strong>
                {
                  position
                    .instruments
                    ?.name
                }
              </strong>

              <span>
                {Math.round(
                  Number(
                    position.current_value
                  )
                ).toLocaleString(
                  'cs-CZ'
                )}{' '}
                Kč
              </span>
            </div>
          )
        )}
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
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
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