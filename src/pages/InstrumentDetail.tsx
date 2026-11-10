type Props = {
  position: any
  onClose: () => void
}

export default function InstrumentDetail({
  position,
  onClose,
}: Props) {
  const cost = Number(position.total_cost)

  const value = Number(
    position.current_value
  )

  const profit = value - cost

  const profitPct =
    cost > 0
      ? (
          (profit / cost) *
          100
        ).toFixed(1)
      : '0'

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
        }}
      >
        <h2>
          {
            position.instruments
              ?.name
          }
        </h2>

        <button
          onClick={onClose}
        >
          Zavřít
        </button>
      </div>

      <p>
        Počet ks:
        {' '}
        {position.quantity}
      </p>

      <p>
        Náklady:
        {' '}
        {cost.toLocaleString(
          'cs-CZ'
        )}
        {' '}
        Kč
      </p>

      <p>
        Hodnota:
        {' '}
        {value.toLocaleString(
          'cs-CZ'
        )}
        {' '}
        Kč
      </p>

      <p>
        Zisk:
        {' '}
        {profit.toLocaleString(
          'cs-CZ'
        )}
        {' '}
        Kč
      </p>

      <p>
        Výnos:
        {' '}
        {profitPct}
        %
      </p>
    </div>
  )
}