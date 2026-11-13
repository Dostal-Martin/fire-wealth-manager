import { supabase } from '../lib/supabase'
import type {
  FireTargetMode,
  RetirementEvent,
  RetirementPlanInput,
  WithdrawalStrategy,
} from '../domain/retirementPlan'

const PORTFOLIO_ID = '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type RetirementScenario = RetirementPlanInput & {
  id: string
  name: string
  isActive: boolean
  targetMode: FireTargetMode
  currentAgeYears: number
  currentAgeMonths: number
  monthlyContributionCzk: number
  accumulationReturnRate: number
  retirementReturnRate: number
  manualFireTargetCzk: number
  annualSpendingCzk: number
  targetSwr: number
}

type ScenarioRow = {
  id: string
  name: string
  is_active: boolean
  target_mode: FireTargetMode
  current_age_years: number
  current_age_months: number
  monthly_contribution: number | string
  manual_fire_target_czk: number | string
  annual_spending_czk: number | string
  target_swr: number | string
  nominal_return_rate: number | string
  inflation_rate: number | string
  retirement_return_rate: number | string
  retirement_start_age_years: number
  retirement_start_age_months: number
  retirement_end_age_years: number
  retirement_end_age_months: number
  monthly_retirement_income_czk: number | string
  terminal_capital_czk: number | string
  pension_start_age_years: number
  pension_start_age_months: number
  monthly_pension_czk: number | string
  income_indexed: boolean
  withdrawal_strategy: WithdrawalStrategy
}

type EventRow = {
  id: string
  scenario_id: string
  age_years: number
  age_months: number
  amount_czk: number | string
  description: string
  inflation_indexed: boolean
  enabled: boolean
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function mapEvent(row: EventRow): RetirementEvent {
  return {
    id: row.id,
    ageYears: row.age_years,
    ageMonths: row.age_months,
    amountCzk: num(row.amount_czk),
    description: row.description,
    inflationIndexed: row.inflation_indexed,
    enabled: row.enabled,
  }
}

function mapScenario(row: ScenarioRow, events: RetirementEvent[]): RetirementScenario {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    targetMode: row.target_mode,
    currentAgeYears: row.current_age_years,
    currentAgeMonths: row.current_age_months,
    monthlyContributionCzk: num(row.monthly_contribution),
    manualFireTargetCzk: num(row.manual_fire_target_czk),
    annualSpendingCzk: num(row.annual_spending_czk),
    targetSwr: num(row.target_swr),
    accumulationReturnRate: num(row.nominal_return_rate),
    retirementReturnRate: num(row.retirement_return_rate),
    startAgeYears: row.retirement_start_age_years,
    startAgeMonths: row.retirement_start_age_months,
    endAgeYears: row.retirement_end_age_years,
    endAgeMonths: row.retirement_end_age_months,
    monthlyIncomeTargetCzk: num(row.monthly_retirement_income_czk),
    nominalReturnRate: num(row.retirement_return_rate),
    inflationRate: num(row.inflation_rate),
    pensionStartAgeYears: row.pension_start_age_years,
    pensionStartAgeMonths: row.pension_start_age_months,
    monthlyPensionCzk: num(row.monthly_pension_czk),
    incomeIndexed: row.income_indexed,
    terminalCapitalCzk: num(row.terminal_capital_czk),
    withdrawalStrategy: row.withdrawal_strategy,
    events,
  }
}

async function getScenarioEvents(scenarioIds: string[]) {
  if (scenarioIds.length === 0) return new Map<string, RetirementEvent[]>()
  const { data, error } = await supabase
    .from('retirement_events')
    .select('id,scenario_id,age_years,age_months,amount_czk,description,inflation_indexed,enabled')
    .in('scenario_id', scenarioIds)
    .order('age_years')
    .order('age_months')
  if (error) throw error

  const map = new Map<string, RetirementEvent[]>()
  for (const row of (data ?? []) as EventRow[]) {
    const list = map.get(row.scenario_id) ?? []
    list.push(mapEvent(row))
    map.set(row.scenario_id, list)
  }
  return map
}

export async function getRetirementScenarios(): Promise<RetirementScenario[]> {
  const { data, error } = await supabase
    .from('retirement_scenarios')
    .select('*')
    .eq('portfolio_id', PORTFOLIO_ID)
    .order('is_active', { ascending: false })
    .order('name')
  if (error) throw error

  const rows = (data ?? []) as ScenarioRow[]
  const eventMap = await getScenarioEvents(rows.map((row) => row.id))
  return rows.map((row) => mapScenario(row, eventMap.get(row.id) ?? []))
}

export async function getActiveRetirementScenario() {
  const scenarios = await getRetirementScenarios()
  return scenarios.find((scenario) => scenario.isActive) ?? scenarios[0] ?? null
}

export async function saveRetirementScenario(scenario: RetirementScenario) {
  const payload = {
    portfolio_id: PORTFOLIO_ID,
    name: scenario.name.trim(),
    is_active: scenario.isActive,
    target_mode: scenario.targetMode,
    current_age_years: scenario.currentAgeYears,
    current_age_months: scenario.currentAgeMonths,
    monthly_contribution: scenario.monthlyContributionCzk,
    manual_fire_target_czk: scenario.manualFireTargetCzk,
    annual_spending_czk: scenario.annualSpendingCzk,
    target_swr: scenario.targetSwr,
    nominal_return_rate: scenario.accumulationReturnRate,
    retirement_return_rate: scenario.retirementReturnRate,
    inflation_rate: scenario.inflationRate,
    retirement_start_age_years: scenario.startAgeYears,
    retirement_start_age_months: scenario.startAgeMonths,
    retirement_end_age_years: scenario.endAgeYears,
    retirement_end_age_months: scenario.endAgeMonths,
    monthly_retirement_income_czk: scenario.monthlyIncomeTargetCzk,
    terminal_capital_czk: scenario.terminalCapitalCzk,
    pension_start_age_years: scenario.pensionStartAgeYears,
    pension_start_age_months: scenario.pensionStartAgeMonths,
    monthly_pension_czk: scenario.monthlyPensionCzk,
    income_indexed: scenario.incomeIndexed,
    withdrawal_strategy: scenario.withdrawalStrategy,
    updated_at: new Date().toISOString(),
  }

  // Partial unique index allows only one active scenario. Deactivate old active first.
  if (scenario.isActive) {
    const { error: deactivateError } = await supabase
      .from('retirement_scenarios')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('portfolio_id', PORTFOLIO_ID)
      .neq('id', scenario.id)
    if (deactivateError) throw deactivateError
  }

  const { data, error } = await supabase
    .from('retirement_scenarios')
    .update(payload)
    .eq('id', scenario.id)
    .eq('portfolio_id', PORTFOLIO_ID)
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function createRetirementScenario(
  name: string,
  template: Omit<RetirementScenario, 'id' | 'name' | 'isActive' | 'events'>,
) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('retirement_scenarios')
    .insert({
      portfolio_id: PORTFOLIO_ID,
      name: name.trim(),
      is_active: false,
      target_mode: template.targetMode,
      current_age_years: template.currentAgeYears,
      current_age_months: template.currentAgeMonths,
      monthly_contribution: template.monthlyContributionCzk,
      manual_fire_target_czk: template.manualFireTargetCzk,
      annual_spending_czk: template.annualSpendingCzk,
      target_swr: template.targetSwr,
      nominal_return_rate: template.accumulationReturnRate,
      retirement_return_rate: template.retirementReturnRate,
      inflation_rate: template.inflationRate,
      retirement_start_age_years: template.startAgeYears,
      retirement_start_age_months: template.startAgeMonths,
      retirement_end_age_years: template.endAgeYears,
      retirement_end_age_months: template.endAgeMonths,
      monthly_retirement_income_czk: template.monthlyIncomeTargetCzk,
      terminal_capital_czk: template.terminalCapitalCzk,
      pension_start_age_years: template.pensionStartAgeYears,
      pension_start_age_months: template.pensionStartAgeMonths,
      monthly_pension_czk: template.monthlyPensionCzk,
      income_indexed: template.incomeIndexed,
      withdrawal_strategy: template.withdrawalStrategy,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function createRetirementEvent(scenarioId: string, event: Omit<RetirementEvent, 'id'>) {
  const { data, error } = await supabase.from('retirement_events').insert({
    scenario_id: scenarioId,
    age_years: event.ageYears,
    age_months: event.ageMonths,
    amount_czk: event.amountCzk,
    description: event.description.trim(),
    inflation_indexed: event.inflationIndexed,
    enabled: event.enabled,
  }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updateRetirementEvent(scenarioId: string, event: RetirementEvent) {
  if (!event.id) throw new Error('Událost nemá ID.')
  const { error } = await supabase.from('retirement_events').update({
    age_years: event.ageYears,
    age_months: event.ageMonths,
    amount_czk: event.amountCzk,
    description: event.description.trim(),
    inflation_indexed: event.inflationIndexed,
    enabled: event.enabled,
    updated_at: new Date().toISOString(),
  }).eq('id', event.id).eq('scenario_id', scenarioId)
  if (error) throw error
}

export async function deleteRetirementEvent(scenarioId: string, eventId: string) {
  const { error } = await supabase.from('retirement_events').delete().eq('id', eventId).eq('scenario_id', scenarioId)
  if (error) throw error
}
