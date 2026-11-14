import type { CoupledFirePlanResult, CoupledPlanStatus } from '../domain/coupledFirePlan'

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactMoney(value: number) {
  return `${(value / 1_000_000).toLocaleString('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} mil. Kč`
}

function formatDate(value: Date | null) {
  return value
    ? value.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
    : 'V modelovaném horizontu nenalezeno'
}

function statusLabel(status: CoupledPlanStatus) {
  if (status === 'DEFICIT') return 'Zvolené datum není financované'
  if (status === 'MATHEMATICAL') return 'Matematicky splněno bez bezpečné rezervy'
  if (status === 'RESERVE_5') return 'Splněno s rezervou alespoň 5 %'
  return 'Robustně splněno s rezervou alespoň 10 %'
}

export default function CoupledFirePlanSummary({ result }: { result: CoupledFirePlanResult }) {
  const deficit = Math.max(-result.plannedReserveCzk, 0)
  const reserve = Math.max(result.plannedReserveCzk, 0)

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2>Provázaný plán akumulace a renty</h2>
          <p>Projektovaný a potřebný kapitál jsou porovnány ke stejnému datu v dnešních cenách.</p>
        </div>
      </div>
      <div className="panel-body">
        <div className="kpi-grid">
          <Metric label="Zvolené datum přechodu" value={formatDate(result.plannedDate)} detail={statusLabel(result.plannedStatus)} />
          <Metric label="Projektovaný kapitál" value={formatCompactMoney(result.projectedCapitalAtPlannedDateCzk)} detail="Při současném tempu investování" />
          <Metric label="Potřebný kapitál" value={formatCompactMoney(result.requiredCapitalAtPlannedDateCzk)} detail="Pro rentu a délku čerpání v tomto datu" />
          <Metric
            label={deficit > 0 ? 'Deficit' : 'Modelová rezerva'}
            value={formatCompactMoney(deficit > 0 ? deficit : reserve)}
            detail={`${(result.plannedReserveRatio * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} % vůči potřebnému kapitálu`}
          />
          <Metric label="Nejdřívější proveditelné datum" value={formatDate(result.earliestFeasibleDate)} detail={result.earliestFeasibleAgeYears === null ? 'Nedosaženo' : `${result.earliestFeasibleAgeYears} let ${result.earliestFeasibleAgeMonths} měs.`} />
          <Metric label="Udržitelná renta ve zvoleném datu" value={`${formatMoney(result.sustainableMonthlyIncomeAtPlannedDateCzk)} / měs.`} detail="Při projektovaném kapitálu a ostatních parametrech" />
          <Metric label="Potřebná měsíční investice" value={`${formatMoney(result.requiredMonthlyContributionCzk)} / měs.`} detail="Pro požadovanou rentu ve zvoleném datu" />
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-description">{detail}</div>
    </div>
  )
}
