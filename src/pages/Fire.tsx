import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import DecimalInput from '../components/DecimalInput'
import { calculateCoupledFirePlan, type CoupledFirePlanResult } from '../domain/coupledFirePlan'
import { calculateAccumulation, formatAge } from '../domain/fireCalculations'
import {
  calculateFundingRatio,
  calculateRequiredStartingCapital,
  calculateRetirementProjection,
  type FireTargetMode,
  type RetirementEvent,
} from '../domain/retirementPlan'
import { getCurrentNetWorth } from '../services/fireSettings'
import {
  createRetirementEvent,
  deleteRetirementEvent,
  getRetirementScenarios,
  saveRetirementScenario,
  type RetirementScenario,
} from '../services/retirementPlan'

type FireTab = 'accumulation' | 'rent'
type PlanningMode = 'EARLIEST_DATE' | 'FIXED_DATE'
type Tone = 'default' | 'positive' | 'negative'

type EventDraft = {
  ageYears: number
  ageMonths: number
  amountCzk: number
  description: string
  inflationIndexed: boolean
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
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString('cs-CZ', {
      maximumFractionDigits: 0,
    })} tis. Kč`
  }
  return formatMoney(value)
}

function formatPercent(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toLocaleString('cs-CZ', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`
}

function formatDate(value: Date) {
  return value.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
}

function targetModeLabel(mode: FireTargetMode) {
  if (mode === 'MANUAL') return 'Ruční cíl'
  if (mode === 'SWR') return 'Výdaje + SWR'
  return 'Rentový model'
}

function ageLabel(years: number, months: number) {
  return `${years} let${months ? ` ${months} měs.` : ''}`
}

function retirementTarget(scenario: RetirementScenario) {
  if (scenario.targetMode === 'MANUAL') return scenario.manualFireTargetCzk
  if (scenario.targetMode === 'SWR') {
    return scenario.targetSwr > 0 ? scenario.annualSpendingCzk / scenario.targetSwr : 0
  }
  return calculateRequiredStartingCapital(scenario)
}

export default function Fire() {
  const [activeTab, setActiveTab] = useState<FireTab>('accumulation')
  const [planningMode, setPlanningMode] = useState<PlanningMode>('EARLIEST_DATE')
  const [scenarios, setScenarios] = useState<RetirementScenario[]>([])
  const [scenario, setScenario] = useState<RetirementScenario | null>(null)
  const [currentNetWorth, setCurrentNetWorth] = useState(0)
  const [snapshotDate, setSnapshotDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [eventDraft, setEventDraft] = useState<EventDraft>({
    ageYears: 60,
    ageMonths: 0,
    amountCzk: 500_000,
    description: '',
    inflationIndexed: true,
  })

  async function load(preferredScenarioId?: string) {
    try {
      setLoading(true)
      setError('')
      const [loadedScenarios, netWorth] = await Promise.all([
        getRetirementScenarios(),
        getCurrentNetWorth(),
      ])
      setScenarios(loadedScenarios)
      setCurrentNetWorth(netWorth.value)
      setSnapshotDate(netWorth.date)
      setScenario((current) => {
        const preferred = loadedScenarios.find((item) => item.id === preferredScenarioId)
        const retained = loadedScenarios.find((item) => item.id === current?.id)
        return preferred ?? retained ?? loadedScenarios.find((item) => item.isActive) ?? loadedScenarios[0] ?? null
      })
    } catch (reason) {
      console.error('FIRE v1.3:', reason)
      setError(reason instanceof Error ? reason.message : 'FIRE plán se nepodařilo načíst.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const coupledPlan = useMemo(() => {
    if (!scenario) return null

    try {
      return calculateCoupledFirePlan({
        currentCapitalCzk: currentNetWorth,
        currentAgeYears: scenario.currentAgeYears,
        currentAgeMonths: scenario.currentAgeMonths,
        plannedStartAgeYears: scenario.startAgeYears,
        plannedStartAgeMonths: scenario.startAgeMonths,
        monthlyContributionCzk: scenario.monthlyContributionCzk,
        accumulationNominalReturnRate: scenario.accumulationReturnRate,
        inflationRate: scenario.inflationRate,
        retirementPlan: {
          ...scenario,
          nominalReturnRate: scenario.retirementReturnRate,
        },
      })
    } catch (reason) {
      console.error('Provázaný FIRE plán:', reason)
      return null
    }
  }, [scenario, currentNetWorth])

  const effectiveScenario = useMemo(() => {
    if (!scenario || planningMode !== 'EARLIEST_DATE' || !coupledPlan) return scenario
    if (
      coupledPlan.earliestFeasibleAgeYears === null ||
      coupledPlan.earliestFeasibleAgeMonths === null
    ) return scenario

    return {
      ...scenario,
      startAgeYears: coupledPlan.earliestFeasibleAgeYears,
      startAgeMonths: coupledPlan.earliestFeasibleAgeMonths,
    }
  }, [scenario, planningMode, coupledPlan])

  const requiredCapital = useMemo(() => {
    if (!effectiveScenario) return 0
    try {
      return calculateRequiredStartingCapital({
        ...effectiveScenario,
        nominalReturnRate: effectiveScenario.retirementReturnRate,
      })
    } catch {
      return 0
    }
  }, [effectiveScenario])

  const activeTarget = useMemo(
    () => effectiveScenario ? retirementTarget(effectiveScenario) : 0,
    [effectiveScenario],
  )

  const fundingRatio = useMemo(
    () => calculateFundingRatio(currentNetWorth, activeTarget),
    [currentNetWorth, activeTarget],
  )

  const accumulation = useMemo(() => {
    if (!effectiveScenario) return null
    return calculateAccumulation({
      startCapital: currentNetWorth,
      monthlyContribution: effectiveScenario.monthlyContributionCzk,
      targetCapital: activeTarget,
      nominalReturn: effectiveScenario.accumulationReturnRate,
      inflation: effectiveScenario.inflationRate,
      currentAgeMonths:
        effectiveScenario.currentAgeYears * 12 + effectiveScenario.currentAgeMonths,
    })
  }, [effectiveScenario, currentNetWorth, activeTarget])

  const retirementProjection = useMemo(() => {
    if (!effectiveScenario) return null
    try {
      return calculateRetirementProjection(requiredCapital, {
        ...effectiveScenario,
        nominalReturnRate: effectiveScenario.retirementReturnRate,
      })
    } catch {
      return null
    }
  }, [effectiveScenario, requiredCapital])

  const currentCapitalProjection = useMemo(() => {
    if (!effectiveScenario) return null
    try {
      return calculateRetirementProjection(currentNetWorth, {
        ...effectiveScenario,
        nominalReturnRate: effectiveScenario.retirementReturnRate,
      })
    } catch {
      return null
    }
  }, [effectiveScenario, currentNetWorth])

  const retirementChart = useMemo(() => {
    if (!retirementProjection) return []
    return retirementProjection.months
      .filter(
        (row) =>
          row.monthIndex % 12 === 11 ||
          row.monthIndex === retirementProjection.months.length - 1,
      )
      .map((row) => ({
        age: `${row.ageYears} let${row.ageMonths ? ` ${row.ageMonths} měs.` : ''}`,
        capital: Math.max(0, row.closingCapitalCzk),
        withdrawal: row.portfolioWithdrawalCzk,
        pension: row.pensionIncomeCzk,
        event: row.eventWithdrawalCzk,
      }))
  }, [retirementProjection])

  function patch<K extends keyof RetirementScenario>(key: K, value: RetirementScenario[K]) {
    setScenario((current) => current ? { ...current, [key]: value } : current)
  }

  async function handleSave() {
    if (!scenario) return
    try {
      setSaving(true)
      setMessage('')
      setError('')
      await saveRetirementScenario(scenario)
      setMessage('FIRE scénář byl uložen.')
      await load(scenario.id)
    } catch (reason) {
      console.error('FIRE save:', reason)
      setError(reason instanceof Error ? reason.message : 'FIRE scénář se nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddEvent() {
    if (!scenario || !eventDraft.description.trim() || eventDraft.amountCzk <= 0) return
    try {
      setSaving(true)
      await createRetirementEvent(scenario.id, {
        ...eventDraft,
        description: eventDraft.description.trim(),
        enabled: true,
      })
      setEventDraft({
        ageYears: scenario.startAgeYears,
        ageMonths: scenario.startAgeMonths,
        amountCzk: 500_000,
        description: '',
        inflationIndexed: true,
      })
      await load(scenario.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Událost se nepodařilo přidat.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEvent(event: RetirementEvent) {
    if (!scenario || !event.id) return
    try {
      setSaving(true)
      await deleteRetirementEvent(scenario.id, event.id)
      await load(scenario.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Událost se nepodařilo odstranit.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page"><div className="loading-box">Načítám FIRE plán...</div></div>
  if (!scenario) return <div className="page"><div className="error-box">Neexistuje žádný FIRE scénář. Spusť seed nebo vytvoř scénář v databázi.</div></div>

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">FIRE</h1>
          <p className="page-subtitle">Propojený plán akumulace kapitálu a konfigurovatelného čerpání renty.</p>
        </div>
        <button className="button-primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Ukládám...' : 'Uložit scénář'}
        </button>
      </header>

      {(message || error) && <StatusMessage message={error || message} error={Boolean(error)} />}

      <section className="panel" style={{ marginBottom: '16px' }}>
        <div className="panel-body">
          <div className="fire-settings-grid">
            {scenarios.length > 1 && (
              <Field label="Scénář">
                <select
                  className="form-control"
                  value={scenario.id}
                  onChange={(event) => setScenario(scenarios.find((item) => item.id === event.target.value) ?? scenario)}
                >
                  {scenarios.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}{item.isActive ? ' · aktivní' : ''}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Zdroj cíle">
              <select className="form-control" value={scenario.targetMode} onChange={(event) => patch('targetMode', event.target.value as FireTargetMode)}>
                <option value="RETIREMENT_MODEL">Rentový model</option>
                <option value="SWR">Výdaje + SWR</option>
                <option value="MANUAL">Ruční cíl</option>
              </select>
            </Field>
          </div>
        </div>
      </section>

      <PlanningModeSelector value={planningMode} onChange={setPlanningMode} />

      {coupledPlan && (
        <FireDecisionSummary
          mode={planningMode}
          result={coupledPlan}
          desiredIncomeCzk={scenario.monthlyIncomeTargetCzk}
          inflationRate={scenario.inflationRate}
        />
      )}

      <TabSelector value={activeTab} onChange={setActiveTab} />

      {activeTab === 'accumulation' && accumulation && (
        <AccumulationView
          scenario={effectiveScenario ?? scenario}
          patch={patch}
          currentNetWorth={currentNetWorth}
          snapshotDate={snapshotDate}
          activeTarget={activeTarget}
          requiredCapital={requiredCapital}
          fundingRatio={fundingRatio}
          accumulation={accumulation}
        />
      )}

      {activeTab === 'rent' && retirementProjection && (
        <RentView
          scenario={effectiveScenario ?? scenario}
          patch={patch}
          requiredCapital={requiredCapital}
          lockStartAge={planningMode === 'EARLIEST_DATE'}
          fundingRatio={fundingRatio}
          currentNetWorth={currentNetWorth}
          projection={retirementProjection}
          currentProjection={currentCapitalProjection}
          chartData={retirementChart}
          eventDraft={eventDraft}
          setEventDraft={setEventDraft}
          onAddEvent={() => void handleAddEvent()}
          onDeleteEvent={(event) => void handleDeleteEvent(event)}
          saving={saving}
        />
      )}
    </div>
  )
}

function AccumulationView({
  scenario,
  patch,
  currentNetWorth,
  snapshotDate,
  activeTarget,
  requiredCapital,
  fundingRatio,
  accumulation,
}: {
  scenario: RetirementScenario
  patch: <K extends keyof RetirementScenario>(key: K, value: RetirementScenario[K]) => void
  currentNetWorth: number
  snapshotDate: string
  activeTarget: number
  requiredCapital: number
  fundingRatio: number | null
  accumulation: ReturnType<typeof calculateAccumulation>
}) {
  const missing = Math.max(0, activeTarget - currentNetWorth)

  return (
    <>
      <SectionHeading title="Akumulační fáze" description="Aktuální investovatelný kapitál směřuje k cíli určenému vybraným scénářem." />

      <section className="kpi-grid">
        <MetricCard label="Aktuální kapitál" value={formatCompactMoney(currentNetWorth)} description={snapshotDate ? `Live stav ${snapshotDate}` : formatMoney(currentNetWorth)} />
        <MetricCard label={scenario.targetMode === 'RETIREMENT_MODEL' ? 'Rentový cíl' : 'FIRE cíl'} value={formatCompactMoney(activeTarget)} description={targetModeLabel(scenario.targetMode)} />
        <MetricCard label="Funding ratio" value={formatPercent(fundingRatio, 1)} description={`Chybí ${formatCompactMoney(missing)}`} tone={(fundingRatio ?? 0) >= 1 ? 'positive' : 'default'} />
        <MetricCard label="Odhad dosažení" value={accumulation.targetReached ? formatDate(accumulation.estimatedDate) : 'Nedosaženo'} description={accumulation.targetReached ? formatAge(accumulation.fireAgeMonths) : 'Více než 100 let'} />
        <MetricCard label="Cíl rentového modelu" value={formatCompactMoney(requiredCapital)} description={`${formatMoney(scenario.monthlyIncomeTargetCzk)} měsíčně`} />
        <MetricCard label="Měsíční investice" value={formatMoney(scenario.monthlyContributionCzk)} description="Pravidelný externí vklad" />
        <MetricCard label="Reálný výnos" value={formatPercent(accumulation.realReturn, 2)} description="Nominální výnos po inflaci" />
        <MetricCard label="Vlastní prostředky" value={formatCompactMoney(accumulation.totalContributions)} description={formatMoney(accumulation.totalContributions)} />
      </section>

      <div className="fire-layout">
        <section className="panel">
          <PanelHeader title="Parametry akumulace" subtitle="Všechny hodnoty jsou součástí vybraného scénáře" />
          <div className="panel-body">
            <div className="fire-two-fields">
              <IntegerField label="Současný věk" value={scenario.currentAgeYears} onChange={(value) => patch('currentAgeYears', value)} min={0} max={120} />
              <IntegerField label="Měsíce" value={scenario.currentAgeMonths} onChange={(value) => patch('currentAgeMonths', value)} min={0} max={11} />
            </div>
            <ReadOnlyField label="Aktuální kapitál" value={formatMoney(currentNetWorth)} />
            <NumberField label="Měsíční investice" value={scenario.monthlyContributionCzk} onChange={(value) => patch('monthlyContributionCzk', Math.max(0, value))} suffix="Kč" />

            {scenario.targetMode === 'MANUAL' && (
              <NumberField label="Ruční FIRE cíl" value={scenario.manualFireTargetCzk} onChange={(value) => patch('manualFireTargetCzk', Math.max(0, value))} suffix="Kč" />
            )}
            {scenario.targetMode === 'SWR' && (
              <>
                <NumberField label="Roční výdaje" value={scenario.annualSpendingCzk} onChange={(value) => patch('annualSpendingCzk', Math.max(0, value))} suffix="Kč" />
                <PercentField label="SWR" value={scenario.targetSwr} onChange={(value) => patch('targetSwr', value)} />
              </>
            )}
            {scenario.targetMode === 'RETIREMENT_MODEL' && (
              <div className="fire-note">
                Cíl se automaticky počítá z parametrů záložky Simulátor renty.
                <strong>{formatMoney(requiredCapital)}</strong>
              </div>
            )}

            <div className="fire-two-fields">
              <PercentField label="Výnos v akumulaci p.a." value={scenario.accumulationReturnRate} onChange={(value) => patch('accumulationReturnRate', value)} />
              <PercentField label="Inflace p.a." value={scenario.inflationRate} onChange={(value) => patch('inflationRate', value)} />
            </div>
          </div>
        </section>

        <section className="panel">
          <PanelHeader title="Projekce kapitálu" subtitle="Reálné hodnoty po zohlednění inflace" />
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={460}>
              <LineChart data={accumulation.points} margin={{ top: 10, right: 20, bottom: 5, left: 5 }}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="age" minTickGap={35} tick={chartTick} axisLine={{ stroke: '#e4e7ec' }} tickLine={false} />
                <YAxis width={72} tickFormatter={(value) => `${(Number(value) / 1_000_000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} mil.`} tick={chartTick} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Legend formatter={(value) => value === 'capital' ? 'Kapitál' : 'Vlastní prostředky'} />
                <ReferenceLine y={activeTarget} stroke="#a64b4b" strokeDasharray="5 5" label={{ value: 'Cíl', fill: '#8a5151', fontSize: 11 }} />
                <Line type="monotone" dataKey="capital" stroke="#53657d" strokeWidth={2.4} dot={false} />
                <Line type="monotone" dataKey="contributions" stroke="#aab1bc" strokeWidth={1.7} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </>
  )
}

function RentView({
  scenario,
  patch,
  requiredCapital,
  lockStartAge,
  fundingRatio,
  currentNetWorth,
  projection,
  currentProjection,
  chartData,
  eventDraft,
  setEventDraft,
  onAddEvent,
  onDeleteEvent,
  saving,
}: {
  scenario: RetirementScenario
  patch: <K extends keyof RetirementScenario>(key: K, value: RetirementScenario[K]) => void
  requiredCapital: number
  lockStartAge: boolean
  fundingRatio: number | null
  currentNetWorth: number
  projection: ReturnType<typeof calculateRetirementProjection>
  currentProjection: ReturnType<typeof calculateRetirementProjection> | null
  chartData: Array<{ age: string; capital: number; withdrawal: number; pension: number; event: number }>
  eventDraft: EventDraft
  setEventDraft: (value: EventDraft) => void
  onAddEvent: () => void
  onDeleteEvent: (event: RetirementEvent) => void
  saving: boolean
}) {
  const durationMonths = (scenario.endAgeYears * 12 + scenario.endAgeMonths) - (scenario.startAgeYears * 12 + scenario.startAgeMonths)

  return (
    <>
      <SectionHeading title="Rentová fáze" description="Reverzní výpočet potřebného kapitálu a měsíční projekce čerpání do zvoleného věku." />

      <section className="kpi-grid">
        <MetricCard label="Potřebný počáteční kapitál" value={formatCompactMoney(requiredCapital)} description={formatMoney(requiredCapital)} />
        <MetricCard label="Aktuální kapitál" value={formatCompactMoney(currentNetWorth)} description={formatMoney(currentNetWorth)} />
        <MetricCard label="Funding ratio" value={formatPercent(fundingRatio, 1)} description={(fundingRatio ?? 0) >= 1 ? 'Plán je kapitálově pokrytý' : `Chybí ${formatCompactMoney(Math.max(0, requiredCapital - currentNetWorth))}`} tone={(fundingRatio ?? 0) >= 1 ? 'positive' : 'default'} />
        <MetricCard label="Požadovaná renta" value={formatMoney(scenario.monthlyIncomeTargetCzk)} description="Měsíční částka na začátku" />
        <MetricCard label="Horizont" value={`${Math.floor(durationMonths / 12)} let ${durationMonths % 12} měs.`} description={`${ageLabel(scenario.startAgeYears, scenario.startAgeMonths)} → ${ageLabel(scenario.endAgeYears, scenario.endAgeMonths)}`} />
        <MetricCard label="Cílový konečný kapitál" value={formatCompactMoney(scenario.terminalCapitalCzk)} description={formatMoney(scenario.terminalCapitalCzk)} />
        <MetricCard label="Čerpáno z portfolia" value={formatCompactMoney(projection.totalPortfolioWithdrawalsCzk)} description={formatMoney(projection.totalPortfolioWithdrawalsCzk)} />
        <MetricCard label="Státní důchod" value={formatCompactMoney(projection.totalPensionIncomeCzk)} description="Celkem za období" />
      </section>

      <div className="fire-layout">
        <section className="panel">
          <PanelHeader title="Parametry renty" subtitle="Změna parametrů okamžitě přepočítá potřebný kapitál" />
          <div className="panel-body">
            {lockStartAge ? (
              <ReadOnlyField
                label="Vypočtený začátek renty"
                value={ageLabel(scenario.startAgeYears, scenario.startAgeMonths)}
              />
            ) : (
              <div className="fire-two-fields">
                <IntegerField label="Věk začátku" value={scenario.startAgeYears} onChange={(value) => patch('startAgeYears', value)} min={0} max={120} />
                <IntegerField label="Měsíce" value={scenario.startAgeMonths} onChange={(value) => patch('startAgeMonths', value)} min={0} max={11} />
              </div>
            )}
            <div className="fire-two-fields">
              <IntegerField label="Věk na konci" value={scenario.endAgeYears} onChange={(value) => patch('endAgeYears', value)} min={1} max={130} />
              <IntegerField label="Měsíce" value={scenario.endAgeMonths} onChange={(value) => patch('endAgeMonths', value)} min={0} max={11} />
            </div>
            <NumberField label="Měsíční renta" value={scenario.monthlyIncomeTargetCzk} onChange={(value) => patch('monthlyIncomeTargetCzk', Math.max(0, value))} suffix="Kč" />
            <NumberField label="Cílový konečný kapitál" value={scenario.terminalCapitalCzk} onChange={(value) => patch('terminalCapitalCzk', Math.max(0, value))} suffix="Kč" />
            <div className="fire-two-fields">
              <PercentField label="Výnos v rentě p.a." value={scenario.retirementReturnRate} onChange={(value) => patch('retirementReturnRate', value)} />
              <PercentField label="Inflace p.a." value={scenario.inflationRate} onChange={(value) => patch('inflationRate', value)} />
            </div>

            <div className="fire-subheading">Státní důchod</div>
            <div className="fire-two-fields">
              <IntegerField label="Věk nároku" value={scenario.pensionStartAgeYears} onChange={(value) => patch('pensionStartAgeYears', value)} min={0} max={130} />
              <IntegerField label="Měsíce" value={scenario.pensionStartAgeMonths} onChange={(value) => patch('pensionStartAgeMonths', value)} min={0} max={11} />
            </div>
            <NumberField label="Měsíční důchod" value={scenario.monthlyPensionCzk} onChange={(value) => patch('monthlyPensionCzk', Math.max(0, value))} suffix="Kč" />

            <label className="fire-checkbox">
              <input type="checkbox" checked={scenario.incomeIndexed} onChange={(event) => patch('incomeIndexed', event.target.checked)} />
              <span>Indexovat rentu a důchod inflací</span>
            </label>

            <div className="fire-note">
              Požadovaný startovní kapitál
              <strong>{formatMoney(requiredCapital)}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <PanelHeader title="Vývoj kapitálu" subtitle="Projekce začíná vypočteným potřebným kapitálem" />
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={460}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 5 }}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="age" minTickGap={35} tick={chartTick} axisLine={{ stroke: '#e4e7ec' }} tickLine={false} />
                <YAxis width={72} tickFormatter={(value) => `${(Number(value) / 1_000_000).toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} mil.`} tick={chartTick} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <ReferenceLine y={scenario.terminalCapitalCzk} stroke="#a64b4b" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="capital" name="Kapitál" stroke="#53657d" strokeWidth={2.4} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="fire-result fire-result-positive">
              Model končí na {formatMoney(projection.finalCapitalCzk)}. Pokud by renta začala dnes z aktuálního kapitálu, model by skončil na {formatMoney(currentProjection?.finalCapitalCzk ?? 0)}.
            </div>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '18px' }}>
        <PanelHeader title="Nepravidelné budoucí výdaje" subtitle="Volitelné výdaje v konkrétním věku, například auto, cestování nebo zdravotní rezerva" />
        <div className="panel-body">
          <div className="fire-event-form">
            <IntegerField label="Věk" value={eventDraft.ageYears} onChange={(value) => setEventDraft({ ...eventDraft, ageYears: value })} min={0} max={130} />
            <IntegerField label="Měsíce" value={eventDraft.ageMonths} onChange={(value) => setEventDraft({ ...eventDraft, ageMonths: value })} min={0} max={11} />
            <Field label="Popis"><input className="form-control" value={eventDraft.description} onChange={(event) => setEventDraft({ ...eventDraft, description: event.target.value })} placeholder="Např. nové auto" /></Field>
            <NumberField label="Částka" value={eventDraft.amountCzk} onChange={(value) => setEventDraft({ ...eventDraft, amountCzk: Math.max(0, value) })} suffix="Kč" />
            <div className="fire-event-action"><label className="fire-checkbox"><input type="checkbox" checked={eventDraft.inflationIndexed} onChange={(event) => setEventDraft({ ...eventDraft, inflationIndexed: event.target.checked })} /><span>Indexovat</span></label></div>
            <div className="fire-event-action"><button className="button-primary" type="button" onClick={onAddEvent} disabled={saving || !eventDraft.description.trim() || eventDraft.amountCzk <= 0}>Přidat</button></div>
          </div>

          {scenario.events.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table className="financial-table">
                <thead><tr><th>Věk</th><th>Popis</th><th className="cell-number">Částka</th><th>Indexace</th><th /></tr></thead>
                <tbody>{scenario.events.map((event) => (
                  <tr key={event.id ?? `${event.ageYears}-${event.description}`}>
                    <td>{ageLabel(event.ageYears, event.ageMonths)}</td>
                    <td>{event.description}</td>
                    <td className="cell-number">{formatMoney(event.amountCzk)}</td>
                    <td>{event.inflationIndexed ? 'Ano' : 'Ne'}</td>
                    <td className="cell-number"><button type="button" className="button-secondary" onClick={() => onDeleteEvent(event)}>Odstranit</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div className="fire-section-heading"><h2>{title}</h2><p>{description}</p></div>
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="panel-header"><div><h2 className="panel-title">{title}</h2><div className="panel-subtitle">{subtitle}</div></div></div>
}

function MetricCard({ label, value, description, tone = 'default' }: { label: string; value: string; description?: string; tone?: Tone }) {
  const valueClass = tone === 'positive' ? 'positive' : tone === 'negative' ? 'negative' : ''
  return (
    <div className="kpi-card" style={{ minWidth: 0 }}>
      <div className="kpi-label">{label}</div>
      <div
        className={`kpi-value ${valueClass}`}
        style={{ overflowWrap: 'anywhere', wordBreak: 'normal', lineHeight: 1.15 }}
      >
        {value}
      </div>
      {description && <div className="kpi-description">{description}</div>}
    </div>
  )
}

function PlanningModeSelector({
  value,
  onChange,
}: {
  value: PlanningMode
  onChange: (value: PlanningMode) => void
}) {
  return (
    <section className="panel" style={{ marginBottom: '16px' }}>
      <div className="panel-body">
        <div className="fire-subheading" style={{ marginTop: 0 }}>Co chci zjistit</div>
        <div className="fire-tabs" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={value === 'EARLIEST_DATE' ? 'fire-tab fire-tab-active' : 'fire-tab'}
            onClick={() => onChange('EARLIEST_DATE')}
            style={{ whiteSpace: 'normal', lineHeight: 1.25 }}
          >
            Kdy mohu do renty?
          </button>
          <button
            type="button"
            className={value === 'FIXED_DATE' ? 'fire-tab fire-tab-active' : 'fire-tab'}
            onClick={() => onChange('FIXED_DATE')}
            style={{ whiteSpace: 'normal', lineHeight: 1.25 }}
          >
            Kolik mohu čerpat ve zvoleném věku?
          </button>
        </div>
        <p className="panel-subtitle" style={{ marginTop: '10px' }}>
          {value === 'EARLIEST_DATE'
            ? 'Požadovaná renta je vstup. Začátek renty a potřebný kapitál vypočítá model.'
            : 'Věk začátku je vstup. Model vypočítá udržitelnou rentu a případný deficit.'}
        </p>
      </div>
    </section>
  )
}

function FireDecisionSummary({
  mode,
  result,
  desiredIncomeCzk,
  inflationRate,
}: {
  mode: PlanningMode
  result: CoupledFirePlanResult
  desiredIncomeCzk: number
  inflationRate: number
}) {
  const monthsToStart = mode === 'EARLIEST_DATE'
    ? Math.max(result.earliestFeasibleMonth ?? 0, 0)
    : Math.max(result.plannedMonths, 0)
  const inflationFactor = Math.pow(1 + inflationRate, monthsToStart / 12)

  if (mode === 'EARLIEST_DATE') {
    const projectedReal = result.projectedCapitalAtEarliestDateCzk ?? 0
    const requiredReal = result.requiredCapitalAtEarliestDateCzk ?? 0
    const requiredNominal = requiredReal * inflationFactor
    const incomeNominal = desiredIncomeCzk * inflationFactor
    const reserveReal = Math.max(0, projectedReal - requiredReal)

    return (
      <section className="kpi-grid" style={{ marginBottom: '18px' }}>
        <MetricCard
          label="Nejdřívější proveditelný přechod"
          value={result.earliestFeasibleDate ? formatDate(result.earliestFeasibleDate) : 'Nedosaženo'}
          description={
            result.earliestFeasibleAgeYears === null
              ? 'V modelovaném horizontu není plán financovaný'
              : ageLabel(result.earliestFeasibleAgeYears, result.earliestFeasibleAgeMonths ?? 0)
          }
          tone={result.earliestFeasibleDate ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Potřebný kapitál v dnešních cenách"
          value={formatCompactMoney(requiredReal)}
          description="Autoritativní reálný cíl pro výpočet dosažení"
        />
        <MetricCard
          label="Potřebný kapitál nominálně"
          value={formatCompactMoney(requiredNominal)}
          description={`Stejná kupní síla v okamžiku přechodu · faktor ${inflationFactor.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })}`}
        />
        <MetricCard
          label="Renta v dnešních cenách"
          value={`${formatMoney(desiredIncomeCzk)} / měs.`}
          description="Požadovaná měsíční kupní síla"
        />
        <MetricCard
          label="Renta nominálně při zahájení"
          value={`${formatMoney(incomeNominal)} / měs.`}
          description="Očekávaná částka prvního měsíčního čerpání"
        />
        <MetricCard
          label="Modelová rezerva v dnešních cenách"
          value={formatCompactMoney(reserveReal)}
          description={`Projektovaný kapitál ${formatCompactMoney(projectedReal)}`}
        />
      </section>
    )
  }

  const projectedReal = result.projectedCapitalAtPlannedDateCzk
  const requiredReal = result.requiredCapitalAtPlannedDateCzk
  const requiredNominal = requiredReal * inflationFactor
  const sustainableIncomeReal = result.sustainableMonthlyIncomeAtPlannedDateCzk
  const sustainableIncomeNominal = sustainableIncomeReal * inflationFactor
  const deficit = Math.max(0, -result.plannedReserveCzk)

  return (
    <section className="kpi-grid" style={{ marginBottom: '18px' }}>
      <MetricCard
        label="Zvolený začátek renty"
        value={formatDate(result.plannedDate)}
        description={`Za ${monthsToStart} měsíců · inflace ${(inflationRate * 100).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} % p.a.`}
      />
      <MetricCard
        label="Potřebný kapitál v dnešních cenách"
        value={formatCompactMoney(requiredReal)}
        description={`Projektováno ${formatCompactMoney(projectedReal)} v dnešních cenách`}
        tone={projectedReal >= requiredReal ? 'positive' : 'negative'}
      />
      <MetricCard
        label="Potřebný kapitál nominálně"
        value={formatCompactMoney(requiredNominal)}
        description="Stejná kupní síla vyjádřená korunami v okamžiku přechodu"
      />
      <MetricCard
        label="Udržitelná renta v dnešních cenách"
        value={`${formatMoney(sustainableIncomeReal)} / měs.`}
        description={`Požadavek ${formatMoney(desiredIncomeCzk)} / měs.`}
        tone={sustainableIncomeReal >= desiredIncomeCzk ? 'positive' : 'negative'}
      />
      <MetricCard
        label="Udržitelná renta nominálně"
        value={`${formatMoney(sustainableIncomeNominal)} / měs.`}
        description="Očekávaná částka prvního měsíčního čerpání"
      />
      <MetricCard
        label={deficit > 0 ? 'Deficit v dnešních cenách' : 'Modelová rezerva v dnešních cenách'}
        value={formatCompactMoney(deficit > 0 ? deficit : result.plannedReserveCzk)}
        description={`Potřebná investice ${formatMoney(result.requiredMonthlyContributionCzk)} / měs.`}
        tone={deficit > 0 ? 'negative' : 'positive'}
      />
    </section>
  )
}

function TabSelector({ value, onChange }: { value: FireTab; onChange: (value: FireTab) => void }) {
  return <div className="fire-tabs">
    <button className={value === 'accumulation' ? 'fire-tab fire-tab-active' : 'fire-tab'} onClick={() => onChange('accumulation')}>Akumulace FIRE</button>
    <button className={value === 'rent' ? 'fire-tab fire-tab-active' : 'fire-tab'} onClick={() => onChange('rent')}>Simulátor renty</button>
  </div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="fire-field"><label className="form-label">{label}</label>{children}</div>
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <Field label={label}><input className="form-control" value={value} readOnly /></Field>
}

function IntegerField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number }) {
  const [text, setText] = useState(String(value))

  useEffect(() => setText(String(value)), [value])

  function commit() {
    const parsed = Number(text)
    if (!Number.isFinite(parsed)) {
      setText(String(value))
      return
    }
    const bounded = Math.max(min, Math.min(max, Math.floor(parsed)))
    onChange(bounded)
    setText(String(bounded))
  }

  return <Field label={label}><input className="form-control" type="text" inputMode="numeric" value={text} onChange={(event) => { if (/^\d*$/.test(event.target.value)) setText(event.target.value) }} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} /></Field>
}

function NumberField({ label, value, onChange, suffix, decimals = 2 }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; decimals?: number }) {
  return <Field label={label}><div className="fire-input-suffix"><DecimalInput value={value} onValueChange={onChange} decimalPlaces={decimals} />{suffix && <span>{suffix}</span>}</div></Field>
}

function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><div className="fire-input-suffix"><DecimalInput value={value * 100} onValueChange={(percent) => onChange(percent / 100)} decimalPlaces={3} /><span>%</span></div></Field>
}

function StatusMessage({ message, error = false }: { message: string; error?: boolean }) {
  return <div className={error ? 'fire-status fire-status-error' : 'fire-status'}>{message}</div>
}

const chartTick = { fill: '#98a2b3', fontSize: 11 }
