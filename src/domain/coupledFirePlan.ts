import { calculateRealReturn, annualToMonthlyRate, realContributionForMonth } from './fireCalculations'
import {
  calculateRequiredStartingCapital,
  type RetirementPlanInput,
} from './retirementPlan'

export type CoupledPlanStatus = 'DEFICIT' | 'MATHEMATICAL' | 'RESERVE_5' | 'RESERVE_10'

export type CoupledFirePlanInput = {
  currentCapitalCzk: number
  currentAgeYears: number
  currentAgeMonths: number
  plannedStartAgeYears: number
  plannedStartAgeMonths: number
  monthlyContributionCzk: number
  accumulationNominalReturnRate: number
  inflationRate: number
  retirementPlan: RetirementPlanInput
  calculationDate?: Date
  maxSearchMonths?: number
}

export type CoupledFirePlanResult = {
  plannedMonths: number
  plannedDate: Date
  projectedCapitalAtPlannedDateCzk: number
  requiredCapitalAtPlannedDateCzk: number
  plannedReserveCzk: number
  plannedReserveRatio: number
  plannedStatus: CoupledPlanStatus
  sustainableMonthlyIncomeAtPlannedDateCzk: number
  requiredMonthlyContributionCzk: number
  earliestFeasibleMonth: number | null
  earliestFeasibleDate: Date | null
  earliestFeasibleAgeYears: number | null
  earliestFeasibleAgeMonths: number | null
  projectedCapitalAtEarliestDateCzk: number | null
  requiredCapitalAtEarliestDateCzk: number | null
  earliestReserveCzk: number | null
}

function totalMonths(years: number, months: number) {
  return Math.max(0, Math.trunc(years) * 12 + Math.trunc(months))
}

function dateAfterMonths(date: Date, months: number) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function planAtStartMonth(plan: RetirementPlanInput, startAgeTotalMonths: number): RetirementPlanInput {
  return {
    ...plan,
    startAgeYears: Math.floor(startAgeTotalMonths / 12),
    startAgeMonths: startAgeTotalMonths % 12,
  }
}

export function projectCapitalAtMonth(
  currentCapitalCzk: number,
  monthlyContributionCzk: number,
  accumulationNominalReturnRate: number,
  inflationRate: number,
  months: number,
) {
  const realReturn = calculateRealReturn(accumulationNominalReturnRate, inflationRate)
  const monthlyRealReturn = annualToMonthlyRate(realReturn)
  let capital = Math.max(currentCapitalCzk, 0)

  for (let month = 1; month <= Math.max(0, Math.trunc(months)); month += 1) {
    const contribution = realContributionForMonth(
      monthlyContributionCzk,
      inflationRate,
      month,
      'FIXED_NOMINAL',
    )
    capital = capital * (1 + monthlyRealReturn) + contribution
  }

  return capital
}

function statusFor(projectedCapital: number, requiredCapital: number): CoupledPlanStatus {
  if (requiredCapital <= 0) return 'RESERVE_10'
  const ratio = projectedCapital / requiredCapital - 1
  if (ratio < 0) return 'DEFICIT'
  if (ratio < 0.05) return 'MATHEMATICAL'
  if (ratio < 0.1) return 'RESERVE_5'
  return 'RESERVE_10'
}

function sustainableIncome(
  capitalCzk: number,
  plan: RetirementPlanInput,
) {
  let low = 0
  let high = Math.max(plan.monthlyIncomeTargetCzk * 2, 10_000)

  while (calculateRequiredStartingCapital({ ...plan, monthlyIncomeTargetCzk: high }) <= capitalCzk) {
    high *= 2
    if (high > 100_000_000) break
  }

  for (let step = 0; step < 70; step += 1) {
    const middle = (low + high) / 2
    const required = calculateRequiredStartingCapital({
      ...plan,
      monthlyIncomeTargetCzk: middle,
    })
    if (required <= capitalCzk) low = middle
    else high = middle
  }

  return low
}

function requiredContribution(
  targetCapitalCzk: number,
  input: CoupledFirePlanInput,
  months: number,
) {
  const withoutContributions = projectCapitalAtMonth(
    input.currentCapitalCzk,
    0,
    input.accumulationNominalReturnRate,
    input.inflationRate,
    months,
  )
  if (withoutContributions >= targetCapitalCzk) return 0

  let low = 0
  let high = Math.max(input.monthlyContributionCzk * 2, 10_000)
  while (
    projectCapitalAtMonth(
      input.currentCapitalCzk,
      high,
      input.accumulationNominalReturnRate,
      input.inflationRate,
      months,
    ) < targetCapitalCzk
  ) {
    high *= 2
    if (high > 100_000_000) break
  }

  for (let step = 0; step < 70; step += 1) {
    const middle = (low + high) / 2
    const capital = projectCapitalAtMonth(
      input.currentCapitalCzk,
      middle,
      input.accumulationNominalReturnRate,
      input.inflationRate,
      months,
    )
    if (capital >= targetCapitalCzk) high = middle
    else low = middle
  }

  return high
}

export function calculateCoupledFirePlan(input: CoupledFirePlanInput): CoupledFirePlanResult {
  const currentAge = totalMonths(input.currentAgeYears, input.currentAgeMonths)
  const plannedStartAge = totalMonths(input.plannedStartAgeYears, input.plannedStartAgeMonths)
  const plannedMonths = Math.max(plannedStartAge - currentAge, 0)
  const calculationDate = input.calculationDate ?? new Date()
  const plannedPlan = planAtStartMonth(input.retirementPlan, currentAge + plannedMonths)
  const requiredCapitalAtPlannedDateCzk = calculateRequiredStartingCapital(plannedPlan)
  const projectedCapitalAtPlannedDateCzk = projectCapitalAtMonth(
    input.currentCapitalCzk,
    input.monthlyContributionCzk,
    input.accumulationNominalReturnRate,
    input.inflationRate,
    plannedMonths,
  )
  const plannedReserveCzk = projectedCapitalAtPlannedDateCzk - requiredCapitalAtPlannedDateCzk
  const plannedReserveRatio = requiredCapitalAtPlannedDateCzk > 0
    ? plannedReserveCzk / requiredCapitalAtPlannedDateCzk
    : 0

  const maxSearchMonths = input.maxSearchMonths ?? 50 * 12
  let earliestFeasibleMonth: number | null = null
  let earliestProjected: number | null = null
  let earliestRequired: number | null = null

  for (let month = 0; month <= maxSearchMonths; month += 1) {
    const plan = planAtStartMonth(input.retirementPlan, currentAge + month)
    if (
      totalMonths(plan.startAgeYears, plan.startAgeMonths) >=
      totalMonths(plan.endAgeYears, plan.endAgeMonths)
    ) break

    const required = calculateRequiredStartingCapital(plan)
    const projected = projectCapitalAtMonth(
      input.currentCapitalCzk,
      input.monthlyContributionCzk,
      input.accumulationNominalReturnRate,
      input.inflationRate,
      month,
    )
    if (projected >= required) {
      earliestFeasibleMonth = month
      earliestProjected = projected
      earliestRequired = required
      break
    }
  }

  const earliestAge = earliestFeasibleMonth === null ? null : currentAge + earliestFeasibleMonth

  return {
    plannedMonths,
    plannedDate: dateAfterMonths(calculationDate, plannedMonths),
    projectedCapitalAtPlannedDateCzk,
    requiredCapitalAtPlannedDateCzk,
    plannedReserveCzk,
    plannedReserveRatio,
    plannedStatus: statusFor(projectedCapitalAtPlannedDateCzk, requiredCapitalAtPlannedDateCzk),
    sustainableMonthlyIncomeAtPlannedDateCzk: sustainableIncome(
      projectedCapitalAtPlannedDateCzk,
      plannedPlan,
    ),
    requiredMonthlyContributionCzk: requiredContribution(
      requiredCapitalAtPlannedDateCzk,
      input,
      plannedMonths,
    ),
    earliestFeasibleMonth,
    earliestFeasibleDate: earliestFeasibleMonth === null
      ? null
      : dateAfterMonths(calculationDate, earliestFeasibleMonth),
    earliestFeasibleAgeYears: earliestAge === null ? null : Math.floor(earliestAge / 12),
    earliestFeasibleAgeMonths: earliestAge === null ? null : earliestAge % 12,
    projectedCapitalAtEarliestDateCzk: earliestProjected,
    requiredCapitalAtEarliestDateCzk: earliestRequired,
    earliestReserveCzk:
      earliestProjected === null || earliestRequired === null
        ? null
        : earliestProjected - earliestRequired,
  }
}
