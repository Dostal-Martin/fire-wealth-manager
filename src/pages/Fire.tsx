import fireData from '../data/fireData.json'

export default function Fire() {
  const currentNetWorth =
    fireData.history[
      fireData.history.length - 1
    ].amount

  const fireTarget = Number(
    fireData.settings.fireTarget
  )

  const monthlySavings = Number(
    fireData.settings.fireSavings
  )

  const expectedReturn =
    Number(
      fireData.settings.fireReturn
    ) / 100

  const progress =
    (currentNetWorth / fireTarget) * 100

  const remaining =
    fireTarget - currentNetWorth

  let capital = currentNetWorth

  let months = 0

  while (
    capital < fireTarget &&
    months < 600
  ) {
    capital =
      capital *
        (1 +
          expectedReturn / 12) +
      monthlySavings

    months++
  }

  const yearsToFire = months / 12

  const estimatedFireYear =
    new Date().getFullYear() +
    yearsToFire

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
          value={`${fireTarget.toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="FIRE Progress"
          value={`${progress.toFixed(1)} %`}
        />

        <Card
          title="Chybí do cíle"
          value={`${Math.round(
            remaining
          ).toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Měsíční investice"
          value={`${monthlySavings.toLocaleString(
            'cs-CZ'
          )} Kč`}
        />

        <Card
          title="Odhad FIRE"
          value={estimatedFireYear.toFixed(1)}
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