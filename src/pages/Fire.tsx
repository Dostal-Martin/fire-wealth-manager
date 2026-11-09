import { useEffect, useState } from 'react'

import fireData from '../data/fireData.json'
import { getFireSettings } from '../services/fireSettings'

export default function Fire() {
  const [fireTarget, setFireTarget] =
    useState(25000000)

  const [annualExpenses, setAnnualExpenses] =
    useState(1320000)

  const [withdrawalRate, setWithdrawalRate] =
    useState(0.04)

  const currentNetWorth =
    fireData.history[
      fireData.history.length - 1
    ].amount

  useEffect(() => {
    async function load() {
      const settings =
        await getFireSettings()

      setFireTarget(
        Number(
          settings.target_fire_number
        )
      )

      setAnnualExpenses(
        Number(settings.annual_expenses)
      )

      setWithdrawalRate(
        Number(settings.withdrawal_rate)
      )
    }

    load()
  }, [])

  const progress =
    (currentNetWorth / fireTarget) * 100

  const remaining =
    fireTarget - currentNetWorth

  return (
    <div>
      <h1>🔥 FIRE Dashboard</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(3, 280px)',
          gap: '20px',
        }}
      >
        <Card
          title="Aktuální majetek"
          value={`${Math.round(
            currentNetWorth
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="FIRE cíl"
          value={`${Math.round(
            fireTarget
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="FIRE Progress"
          value={`${progress.toFixed(1)} %`}
        />

        <Card
          title="Roční výdaje"
          value={`${Math.round(
            annualExpenses
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="SWR"
          value={`${(
            withdrawalRate * 100
          ).toFixed(1)} %`}
        />

        <Card
          title="Chybí do cíle"
          value={`${Math.round(
            remaining
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />
      </div>

      <div
        style={{
          marginTop: '40px',
        }}
      >
        <h2>Postup k FIRE</h2>

        <div
          style={{
            background: '#e5e7eb',
            height: '36px',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '36px',
              background: '#16a34a',
            }}
          />
        </div>

        <p
          style={{
            marginTop: '12px',
            fontWeight: 600,
          }}
        >
          {progress.toFixed(1)} %
        </p>
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