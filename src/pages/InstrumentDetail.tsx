type Position = {
  id?: string

  quantity:
    | number
    | string

  total_cost:
    | number
    | string

  current_value:
    | number
    | string

  instruments:
    | {
        name: string
        ticker?: string | null
        asset_type?: string | null
        currency?: string | null
      }
    | null
}

type Props = {
  position: Position
  onClose: () => void
}

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    'cs-CZ',
    {
      style: 'currency',
      currency: 'CZK',
      maximumFractionDigits: 0,
    }
  ).format(value)
}

function formatNumber(
  value: number
) {
  return value.toLocaleString(
    'cs-CZ',
    {
      maximumFractionDigits: 6,
    }
  )
}

function formatPercent(
  value: number
) {
  if (
    !Number.isFinite(value)
  ) {
    return '—'
  }

  const prefix =
    value > 0
      ? '+'
      : ''

  return `${prefix}${value.toLocaleString(
    'cs-CZ',
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )} %`
}

function formatUnitCost(
  totalCost: number,
  quantity: number
) {
  if (quantity <= 0) {
    return '—'
  }

  return formatMoney(
    totalCost /
    quantity
  )
}

export default function InstrumentDetail({
  position,
  onClose,
}: Props) {
  const quantity =
    Number(
      position.quantity
    )

  const cost =
    Number(
      position.total_cost
    )

  const value =
    Number(
      position.current_value
    )

  const profit =
    value - cost

  const profitPercent =
    cost > 0
      ? (
          profit /
          cost
        ) * 100
      : 0

  const resultClass =
    profit > 0
      ? 'instrument-detail-positive'
      : profit < 0
        ? 'instrument-detail-negative'
        : ''

  const instrument =
    position.instruments

  return (
    <section className="instrument-detail">
      <div className="instrument-detail-header">
        <div>
          <div className="instrument-detail-title-row">
            <h2>
              {instrument
                ?.name ??
                'Instrument'}
            </h2>

            {instrument
              ?.ticker && (
              <span className="instrument-detail-ticker">
                {
                  instrument.ticker
                }
              </span>
            )}
          </div>

          <div className="instrument-detail-subtitle">
            {instrument
              ?.asset_type ??
              'Pozice v portfoliu'}
          </div>
        </div>

        <button
          className="instrument-detail-close"
          onClick={onClose}
          aria-label="Zavřít detail"
        >
          Zavřít
        </button>
      </div>

      <div className="instrument-detail-grid">
        <DetailValue
          label="Počet jednotek"
          value={formatNumber(
            quantity
          )}
        />

        <DetailValue
          label="Náklady"
          value={formatMoney(
            cost
          )}
        />

        <DetailValue
          label="Průměrná pořizovací cena"
          value={formatUnitCost(
            cost,
            quantity
          )}
        />

        <DetailValue
          label="Aktuální hodnota"
          value={formatMoney(
            value
          )}
          strong
        />

        <DetailValue
          label="Výsledek"
          value={formatMoney(
            profit
          )}
          className={
            resultClass
          }
        />

        <DetailValue
          label="Výnos"
          value={formatPercent(
            profitPercent
          )}
          className={
            resultClass
          }
        />
      </div>

      <div className="instrument-detail-note">
        Hodnoty pozice jsou vedené
        v CZK. U automaticky
        oceňovaných instrumentů se
        současná hodnota aktualizuje
        podle tržní ceny a příslušného
        měnového kurzu.
      </div>
    </section>
  )
}

function DetailValue({
  label,
  value,
  strong = false,
  className = '',
}: {
  label: string
  value: string
  strong?: boolean
  className?: string
}) {
  return (
    <div className="instrument-detail-value">
      <div className="instrument-detail-label">
        {label}
      </div>

      <div
        className={[
          'instrument-detail-number',

          strong
            ? 'instrument-detail-number-strong'
            : '',

          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </div>
    </div>
  )
}