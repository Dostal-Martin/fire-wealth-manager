export type AccumulationPoint = {
  age: string
  ageMonths: number
  capital: number
  contributions: number
}

export type RentPoint = {
  age: string
  ageMonths: number
  capital: number
  monthlyWithdrawal: number
  pension: number
}

export type AccumulationContributionMode = 'FIXED_NOMINAL' | 'FIXED_REAL'

export type AccumulationResult = {
  realReturn: number
  months: number
  targetReached: boolean
  finalCapital: number
  totalContributions: number
  investmentGain: number
  gainShare: number
  estimatedDate: Date
  fireAgeMonths: number
  points: AccumulationPoint[]
}

export type RentResult = {
  initialSWR: number
  sustainable: boolean
  depletionMonth: number | null
  endingCapital: number
  endingAgeMonths: number
  totalWithdrawn: number
  totalPension: number
  finalIndexedRent: number
  points: RentPoint[]
}

export type CalculateAccumulationInput = {
  startCapital: number
  monthlyContribution: number
  targetCapital: number
  nominalReturn: number
  inflation: number
  currentAgeMonths: number
  calculationDate?: Date
  contributionMode?: AccumulationContributionMode
}

export type CalculateRentInput = {
  startCapital: number
  startAgeMonths: number
  monthlyRent: number
  nominalReturn: number
  inflation: number
  years: number
  pensionAge: number
  pensionAmount: number
  indexation: boolean
  dynamic: boolean
}

export const MAX_SIMULATION_MONTHS = 100 * 12

export function formatAge(totalMonths: number) {
  const normalized = Math.max(Math.round(totalMonths), 0)
  const years = Math.floor(normalized / 12)
  const months = normalized % 12

  if (months === 0) return `${years} let`
  return `${years} let ${months} měs.`
}

export function annualToMonthlyRate(annualRate: number) {
  if (!Number.isFinite(annualRate)) return 0
  if (annualRate <= -1) return -1
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

export function calculateRealReturn(nominalReturn: number, inflation: number) {
  if (!Number.isFinite(nominalReturn) || !Number.isFinite(inflation)) return 0
  if (inflation <= -1) return 0
  return (1 + nominalReturn) / (1 + inflation) - 1
}

export function realContributionForMonth(
  monthlyContribution: number,
  inflation: number,
  month: number,
  mode: AccumulationContributionMode,
) {
  const normalizedContribution = Math.max(monthlyContribution, 0)
  if (mode === 'FIXED_REAL' || month <= 0 || inflation === 0) {
    return normalizedContribution
  }

  const inflationFactor = Math.pow(1 + Math.max(inflation, -0.999999), month / 12)
  return normalizedContribution / inflationFactor
}

export function calculateAccumulation({
  startCapital,
  monthlyContribution,
  targetCapital,
  nominalReturn,
  inflation,
  currentAgeMonths,
  calculationDate = new Date(),
  contributionMode = 'FIXED_NOMINAL',
}: CalculateAccumulationInput): AccumulationResult {
  const realReturn = calculateRealReturn(nominalReturn, inflation)
  const monthlyRate = annualToMonthlyRate(realReturn)
  const normalizedTarget = Math.max(targetCapital, 0)
  const normalizedStart = Math.max(startCapital, 0)

  let capital = normalizedStart
  let totalContributions = normalizedStart
  let month = 0

  const points: AccumulationPoint[] = [
    {
      age: formatAge(currentAgeMonths),
      ageMonths: currentAgeMonths,
      capital,
      contributions: totalContributions,
    },
  ]

  while (capital < normalizedTarget && month < MAX_SIMULATION_MONTHS) {
    month += 1
    const realContribution = realContributionForMonth(
      monthlyContribution,
      inflation,
      month,
      contributionMode,
    )

    capital = capital * (1 + monthlyRate) + realContribution
    totalContributions += realContribution

    if (month % 12 === 0 || capital >= normalizedTarget || month === MAX_SIMULATION_MONTHS) {
      points.push({
        age: formatAge(currentAgeMonths + month),
        ageMonths: currentAgeMonths + month,
        capital,
        contributions: totalContributions,
      })
    }
  }

  const targetReached = capital >= normalizedTarget
  const estimatedDate = new Date(calculationDate)
  estimatedDate.setMonth(estimatedDate.getMonth() + month)

  const investmentGain = Math.max(capital - totalContributions, 0)
  const gainShare = capital > 0 ? (investmentGain / capital) * 100 : 0

  return {
    realReturn,
    months: month,
    targetReached,
    finalCapital: capital,
    totalContributions,
    investmentGain,
    gainShare,
    estimatedDate,
    fireAgeMonths: currentAgeMonths + month,
    points,
  }
}

export function calculateRent({
  startCapital,
  startAgeMonths,
  monthlyRent,
  nominalReturn,
  inflation,
  years,
  pensionAge,
  pensionAmount,
  indexation,
  dynamic,
}: CalculateRentInput): RentResult {
  const monthlyReturn = annualToMonthlyRate(nominalReturn)
  const monthlyInflation = annualToMonthlyRate(inflation)
  const totalMonths = Math.max(Math.round(years * 12), 1)

  let capital = Math.max(startCapital, 0)
  let indexedRent = Math.max(monthlyRent, 0)
  let indexedPension = Math.max(pensionAmount, 0)
  let depletionMonth: number | null = null
  let totalWithdrawn = 0
  let totalPension = 0

  const initialSWR = startCapital > 0
    ? (Math.max(monthlyRent, 0) * 12 / startCapital) * 100
    : 0

  const points: RentPoint[] = [
    {
      age: formatAge(startAgeMonths),
      ageMonths: startAgeMonths,
      capital,
      monthlyWithdrawal: indexedRent,
      pension: 0,
    },
  ]

  for (let month = 1; month <= totalMonths; month += 1) {
    const currentAgeMonths = startAgeMonths + month
    const pension = currentAgeMonths >= Math.round(pensionAge * 12) ? indexedPension : 0
    const requestedWithdrawal = dynamic
      ? Math.min(indexedRent, Math.max(capital * 0.04 / 12, 0))
      : indexedRent
    const portfolioWithdrawal = Math.max(requestedWithdrawal - pension, 0)

    capital = capital * (1 + monthlyReturn) - portfolioWithdrawal
    totalWithdrawn += portfolioWithdrawal
    totalPension += pension

    if (capital <= 0 && depletionMonth === null) {
      capital = 0
      depletionMonth = month
    }

    if (indexation) {
      indexedRent *= 1 + monthlyInflation
      indexedPension *= 1 + monthlyInflation
    }

    if (month % 12 === 0 || month === totalMonths || depletionMonth === month) {
      points.push({
        age: formatAge(currentAgeMonths),
        ageMonths: currentAgeMonths,
        capital,
        monthlyWithdrawal: requestedWithdrawal,
        pension,
      })
    }
  }

  return {
    initialSWR,
    sustainable: depletionMonth === null,
    depletionMonth,
    endingCapital: capital,
    endingAgeMonths: startAgeMonths + totalMonths,
    totalWithdrawn,
    totalPension,
    finalIndexedRent: indexedRent,
    points,
  }
}
