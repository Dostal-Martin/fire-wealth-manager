export type RetirementPriceViewInput = {
  currentAgeYears: number
  currentAgeMonths: number
  retirementStartAgeYears: number
  retirementStartAgeMonths: number
  inflationRate: number
  fireTargetTodayCzk: number
  monthlyIncomeTodayCzk: number
  terminalCapitalTodayCzk: number
}

export type RetirementPriceView = {
  monthsToRetirement: number
  inflationFactor: number
  fireTargetTodayCzk: number
  fireTargetAtRetirementCzk: number
  monthlyIncomeTodayCzk: number
  monthlyIncomeAtRetirementCzk: number
  terminalCapitalTodayCzk: number
  terminalCapitalAtRetirementCzk: number
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0
}

export function ageInMonths(years: number, months: number) {
  const safeYears = Number.isFinite(years) ? Math.max(Math.trunc(years), 0) : 0
  const safeMonths = Number.isFinite(months) ? Math.max(Math.trunc(months), 0) : 0
  return safeYears * 12 + safeMonths
}

export function calculateMonthsToRetirement(
  currentAgeYears: number,
  currentAgeMonths: number,
  retirementStartAgeYears: number,
  retirementStartAgeMonths: number,
) {
  const currentAge = ageInMonths(currentAgeYears, currentAgeMonths)
  const retirementAge = ageInMonths(retirementStartAgeYears, retirementStartAgeMonths)
  return Math.max(retirementAge - currentAge, 0)
}

export function calculateInflationFactor(inflationRate: number, months: number) {
  if (!Number.isFinite(inflationRate) || inflationRate <= -1) {
    throw new Error('Inflace musí být větší než -100 %.')
  }

  const safeMonths = Number.isFinite(months) ? Math.max(months, 0) : 0
  return Math.pow(1 + inflationRate, safeMonths / 12)
}

export function toNominalFutureCzk(
  amountTodayCzk: number,
  inflationRate: number,
  months: number,
) {
  return finiteNonNegative(amountTodayCzk) * calculateInflationFactor(inflationRate, months)
}

export function toTodayCzk(
  nominalFutureCzk: number,
  inflationRate: number,
  months: number,
) {
  const factor = calculateInflationFactor(inflationRate, months)
  return factor === 0 ? 0 : finiteNonNegative(nominalFutureCzk) / factor
}

export function calculateRetirementPriceView(
  input: RetirementPriceViewInput,
): RetirementPriceView {
  const monthsToRetirement = calculateMonthsToRetirement(
    input.currentAgeYears,
    input.currentAgeMonths,
    input.retirementStartAgeYears,
    input.retirementStartAgeMonths,
  )
  const inflationFactor = calculateInflationFactor(input.inflationRate, monthsToRetirement)

  const fireTargetTodayCzk = finiteNonNegative(input.fireTargetTodayCzk)
  const monthlyIncomeTodayCzk = finiteNonNegative(input.monthlyIncomeTodayCzk)
  const terminalCapitalTodayCzk = finiteNonNegative(input.terminalCapitalTodayCzk)

  return {
    monthsToRetirement,
    inflationFactor,
    fireTargetTodayCzk,
    fireTargetAtRetirementCzk: fireTargetTodayCzk * inflationFactor,
    monthlyIncomeTodayCzk,
    monthlyIncomeAtRetirementCzk: monthlyIncomeTodayCzk * inflationFactor,
    terminalCapitalTodayCzk,
    terminalCapitalAtRetirementCzk: terminalCapitalTodayCzk * inflationFactor,
  }
}
