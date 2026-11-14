type Props = {
  fireTargetTodayCzk: number
  fireTargetAtRetirementCzk: number
  monthlyIncomeTodayCzk: number
  monthlyIncomeAtRetirementCzk: number
  monthsToRetirement: number
  inflationRate: number
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('cs-CZ', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })} mil. Kč`
  }

  return formatMoney(value)
}

function formatHorizon(months: number) {
  const safeMonths = Math.max(0, Math.trunc(months))
  const years = Math.floor(safeMonths / 12)
  const remainingMonths = safeMonths % 12

  if (years === 0) return `${remainingMonths} měs.`
  if (remainingMonths === 0) return `${years} let`
  return `${years} let ${remainingMonths} měs.`
}

function formatPercent(value: number) {
  return value.toLocaleString('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })
}

export default function RetirementPriceSummary({
  fireTargetTodayCzk,
  fireTargetAtRetirementCzk,
  monthlyIncomeTodayCzk,
  monthlyIncomeAtRetirementCzk,
  monthsToRetirement,
  inflationRate,
}: Props) {
  const initialWithdrawalRate =
    fireTargetTodayCzk > 0
      ? (monthlyIncomeTodayCzk * 12) / fireTargetTodayCzk
      : null

  return (
    <section
      className="panel"
      aria-labelledby="retirement-price-summary-title"
      style={{ marginBottom: '18px' }}
    >
      <div className="panel-body" style={{ paddingTop: '14px', paddingBottom: '14px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(250px, 1.2fr) repeat(2, minmax(220px, 1fr))',
            gap: '18px 32px',
            alignItems: 'start',
          }}
        >
          <div>
            <div
              id="retirement-price-summary-title"
              className="kpi-label"
              style={{ marginBottom: '5px' }}
            >
              Jeden plán, dva cenové pohledy
            </div>
            <div className="kpi-description" style={{ lineHeight: 1.55 }}>
              Nejde o dva různé cíle. {formatCompactMoney(fireTargetTodayCzk)} vyjadřuje
              potřebnou kupní sílu v dnešních cenách. {formatMoney(fireTargetAtRetirementCzk)}
              je stejný cíl vyjádřený v očekávaných korunách při zahájení renty za{' '}
              {formatHorizon(monthsToRetirement)}.
            </div>
            <div className="kpi-description" style={{ marginTop: '6px', lineHeight: 1.55 }}>
              Funding ratio a odhad dosažení se nadále počítají v dnešních cenách. Nominální
              pohled slouží pouze jako orientační částka, kterou má v té době ukazovat hodnota
              celého investovatelného portfolia.
            </div>
          </div>

          <PriceItem
            label="Cíl v dnešní kupní síle"
            value={formatMoney(fireTargetTodayCzk)}
            detail={
              initialWithdrawalRate === null
                ? 'Autoritativní cíl rentového modelu.'
                : `Počáteční hrubá míra čerpání ${formatPercent(initialWithdrawalRate * 100)} % ročně před důchodem a dalšími peněžními toky.`
            }
          />

          <PriceItem
            label="Stejný cíl v korunách při zahájení"
            value={formatMoney(fireTargetAtRetirementCzk)}
            detail={`Pouze inflační přepočet při ${formatPercent(inflationRate * 100)} % ročně, nikoli další nezávislý výpočet potřeby kapitálu.`}
          />
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            marginTop: '14px',
            paddingTop: '12px',
            display: 'grid',
            gridTemplateColumns: 'minmax(250px, 1.2fr) repeat(2, minmax(220px, 1fr))',
            gap: '18px 32px',
            alignItems: 'start',
          }}
        >
          <div className="kpi-description" style={{ lineHeight: 1.55 }}>
            Stejná logika platí pro rentu. Reálná renta je plánovaná kupní síla; nominální
            renta je očekávaná částka převodu v prvním měsíci čerpání.
          </div>
          <PriceItem
            label="Renta v dnešní kupní síle"
            value={`${formatMoney(monthlyIncomeTodayCzk)} / měs.`}
            detail="Vstup rentového modelu v dnešních cenách."
          />
          <PriceItem
            label="Stejná renta při zahájení"
            value={`${formatMoney(monthlyIncomeAtRetirementCzk)} / měs.`}
            detail="Inflační přepočet stejné kupní síly do korun v okamžiku zahájení renty."
          />
        </div>
      </div>
    </section>
  )
}

function PriceItem({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div>
      <div className="kpi-label" style={{ marginBottom: '4px' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '20px',
          lineHeight: 1.25,
          fontWeight: 650,
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </div>
      <div className="kpi-description" style={{ marginTop: '4px', lineHeight: 1.45 }}>
        {detail}
      </div>
    </div>
  )
}
