export type FireTargetMode = 'MANUAL' | 'SWR' | 'RETIREMENT_MODEL'
export type WithdrawalStrategy = 'FIXED_REAL' | 'PERCENT_OF_CAPITAL' | 'TARGET_DEPLETION'

export type RetirementEvent = {
  id?: string
  ageYears: number
  ageMonths: number
  amountCzk: number
  description: string
  inflationIndexed: boolean
  enabled: boolean
}

export type RetirementPlanInput = {
  startAgeYears: number
  startAgeMonths: number
  endAgeYears: number
  endAgeMonths: number
  monthlyIncomeTargetCzk: number
  nominalReturnRate: number
  inflationRate: number
  pensionStartAgeYears: number
  pensionStartAgeMonths: number
  monthlyPensionCzk: number
  incomeIndexed: boolean
  terminalCapitalCzk: number
  withdrawalStrategy: WithdrawalStrategy
  events: RetirementEvent[]
}

export type RetirementMonth = {
  monthIndex: number
  ageYears: number
  ageMonths: number
  openingCapitalCzk: number
  investmentReturnCzk: number
  requestedIncomeCzk: number
  pensionIncomeCzk: number
  portfolioWithdrawalCzk: number
  eventWithdrawalCzk: number
  closingCapitalCzk: number
}

export type RetirementProjection = {
  requiredStartingCapitalCzk: number
  finalCapitalCzk: number
  totalPortfolioWithdrawalsCzk: number
  totalPensionIncomeCzk: number
  totalEventWithdrawalsCzk: number
  months: RetirementMonth[]
}

function monthsBetween(startYears: number, startMonths: number, endYears: number, endMonths: number) {
  return (endYears * 12 + endMonths) - (startYears * 12 + startMonths)
}

function monthlyRate(annualRate: number) {
  if (annualRate <= -1) throw new Error('Roční výnos musí být větší než -100 %.')
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

function eventMonthIndex(event: RetirementEvent, input: RetirementPlanInput) {
  return monthsBetween(input.startAgeYears, input.startAgeMonths, event.ageYears, event.ageMonths)
}

function indexedAmount(base: number, monthIndex: number, annualInflation: number) {
  const inflation = monthlyRate(annualInflation)
  return base * Math.pow(1 + inflation, monthIndex)
}

export function validateRetirementPlan(input: RetirementPlanInput) {
  const errors: string[] = []
  const durationMonths = monthsBetween(input.startAgeYears, input.startAgeMonths, input.endAgeYears, input.endAgeMonths)
  if (durationMonths <= 0) errors.push('Konec renty musí být po jejím začátku.')
  if (!Number.isFinite(input.monthlyIncomeTargetCzk) || input.monthlyIncomeTargetCzk < 0) errors.push('Měsíční renta nesmí být záporná.')
  if (!Number.isFinite(input.terminalCapitalCzk) || input.terminalCapitalCzk < 0) errors.push('Konečný kapitál nesmí být záporný.')
  if (input.nominalReturnRate <= -1) errors.push('Výnos musí být větší než -100 %.')
  if (input.inflationRate <= -1) errors.push('Inflace musí být větší než -100 %.')
  if (!Number.isFinite(input.monthlyPensionCzk) || input.monthlyPensionCzk < 0) errors.push('Důchod nesmí být záporný.')
  return { valid: errors.length === 0, errors, durationMonths }
}

function simulate(startingCapitalCzk: number, input: RetirementPlanInput): RetirementProjection {
  const validation = validateRetirementPlan(input)
  if (!validation.valid) throw new Error(validation.errors.join(' '))

  const returnRate = monthlyRate(input.nominalReturnRate)
  const pensionStartMonth = monthsBetween(input.startAgeYears, input.startAgeMonths, input.pensionStartAgeYears, input.pensionStartAgeMonths)
  const activeEvents = input.events.filter((event) => event.enabled)
  const months: RetirementMonth[] = []
  let capital = startingCapitalCzk
  let totalPortfolioWithdrawalsCzk = 0
  let totalPensionIncomeCzk = 0
  let totalEventWithdrawalsCzk = 0

  for (let monthIndex = 0; monthIndex < validation.durationMonths; monthIndex += 1) {
    const openingCapitalCzk = capital
    const investmentReturnCzk = openingCapitalCzk * returnRate
    capital += investmentReturnCzk

    const requestedIncomeCzk = input.incomeIndexed
      ? indexedAmount(input.monthlyIncomeTargetCzk, monthIndex, input.inflationRate)
      : input.monthlyIncomeTargetCzk

    const pensionIncomeCzk = monthIndex >= pensionStartMonth
      ? indexedAmount(input.monthlyPensionCzk, Math.max(0, monthIndex - pensionStartMonth), input.inflationRate)
      : 0

    const portfolioWithdrawalCzk = Math.max(0, requestedIncomeCzk - pensionIncomeCzk)
    const eventWithdrawalCzk = activeEvents
      .filter((event) => eventMonthIndex(event, input) === monthIndex)
      .reduce((sum, event) => sum + (event.inflationIndexed ? indexedAmount(event.amountCzk, monthIndex, input.inflationRate) : event.amountCzk), 0)

    capital -= portfolioWithdrawalCzk + eventWithdrawalCzk
    totalPortfolioWithdrawalsCzk += portfolioWithdrawalCzk
    totalPensionIncomeCzk += pensionIncomeCzk
    totalEventWithdrawalsCzk += eventWithdrawalCzk

    const absoluteAgeMonths = input.startAgeYears * 12 + input.startAgeMonths + monthIndex + 1
    months.push({
      monthIndex,
      ageYears: Math.floor(absoluteAgeMonths / 12),
      ageMonths: absoluteAgeMonths % 12,
      openingCapitalCzk,
      investmentReturnCzk,
      requestedIncomeCzk,
      pensionIncomeCzk,
      portfolioWithdrawalCzk,
      eventWithdrawalCzk,
      closingCapitalCzk: capital,
    })
  }

  return {
    requiredStartingCapitalCzk: startingCapitalCzk,
    finalCapitalCzk: capital,
    totalPortfolioWithdrawalsCzk,
    totalPensionIncomeCzk,
    totalEventWithdrawalsCzk,
    months,
  }
}

export function calculateRequiredStartingCapital(input: RetirementPlanInput) {
  const validation = validateRetirementPlan(input)
  if (!validation.valid) throw new Error(validation.errors.join(' '))

  let low = 0
  let high = Math.max(input.terminalCapitalCzk, input.monthlyIncomeTargetCzk * validation.durationMonths) + 1

  while (simulate(high, input).finalCapitalCzk < input.terminalCapitalCzk) {
    high *= 2
    if (high > 1_000_000_000_000) throw new Error('Potřebný kapitál překročil podporovaný rozsah.')
  }

  for (let i = 0; i < 100; i += 1) {
    const middle = (low + high) / 2
    if (simulate(middle, input).finalCapitalCzk >= input.terminalCapitalCzk) high = middle
    else low = middle
  }
  return high
}

export function calculateRetirementProjection(startingCapitalCzk: number, input: RetirementPlanInput) {
  return simulate(startingCapitalCzk, input)
}

export function calculateFundingRatio(currentCapitalCzk: number, requiredCapitalCzk: number) {
  if (requiredCapitalCzk <= 0) return null
  return currentCapitalCzk / requiredCapitalCzk
}
