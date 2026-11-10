import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

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

import {
  getCurrentNetWorth,
  getFireSettings,
  saveFireSettings,
  type FireSettingsInput,
} from '../services/fireSettings'

type FireTab =
  | 'accumulation'
  | 'rent'

type AccumulationPoint = {
  age: string
  ageMonths: number
  capital: number
  contributions: number
}

type RentPoint = {
  age: string
  ageMonths: number
  capital: number
  monthlyWithdrawal: number
  pension: number
}

type Tone =
  | 'default'
  | 'positive'
  | 'negative'

const MAX_SIMULATION_MONTHS =
  100 * 12

function parseNumber(
  value: string
) {
  const normalized = value
    .replace(/\s/g, '')
    .replace(',', '.')

  const number =
    Number(normalized)

  return Number.isFinite(number)
    ? number
    : 0
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

function formatCompactMoney(
  value: number
) {
  if (
    Math.abs(value) >=
    1_000_000
  ) {
    return `${(
      value / 1_000_000
    ).toLocaleString(
      'cs-CZ',
      {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      }
    )} mil. Kč`
  }

  if (
    Math.abs(value) >=
    1_000
  ) {
    return `${(
      value / 1_000
    ).toLocaleString(
      'cs-CZ',
      {
        maximumFractionDigits: 0,
      }
    )} tis. Kč`
  }

  return formatMoney(value)
}

function formatPercent(
  value: number,
  digits = 1
) {
  if (
    !Number.isFinite(value)
  ) {
    return '—'
  }

  return `${value.toLocaleString(
    'cs-CZ',
    {
      minimumFractionDigits:
        digits,
      maximumFractionDigits:
        digits,
    }
  )} %`
}

function formatAge(
  totalMonths: number
) {
  const normalized =
    Math.max(
      Math.round(totalMonths),
      0
    )

  const years =
    Math.floor(
      normalized / 12
    )

  const months =
    normalized % 12

  if (months === 0) {
    return `${years} let`
  }

  return `${years} let ${months} měs.`
}

function formatDate(
  value: Date
) {
  return value.toLocaleDateString(
    'cs-CZ',
    {
      month: 'long',
      year: 'numeric',
    }
  )
}

function annualToMonthlyRate(
  annualRate: number
) {
  if (annualRate <= -1) {
    return -1
  }

  return (
    Math.pow(
      1 + annualRate,
      1 / 12
    ) - 1
  )
}

function calculateRealReturn(
  nominalReturn: number,
  inflation: number
) {
  if (inflation <= -1) {
    return 0
  }

  return (
    (1 + nominalReturn) /
      (1 + inflation) -
    1
  )
}

function calculateAccumulation(
  startCapital: number,
  monthlyContribution: number,
  targetCapital: number,
  nominalReturn: number,
  inflation: number,
  currentAgeMonths: number
) {
  const realReturn =
    calculateRealReturn(
      nominalReturn,
      inflation
    )

  const monthlyRate =
    annualToMonthlyRate(
      realReturn
    )

  let capital =
    Math.max(
      startCapital,
      0
    )

  let totalContributions =
    Math.max(
      startCapital,
      0
    )

  let month = 0

  const points:
    AccumulationPoint[] = [
      {
        age:
          formatAge(
            currentAgeMonths
          ),

        ageMonths:
          currentAgeMonths,

        capital,

        contributions:
          totalContributions,
      },
    ]

  while (
    capital < targetCapital &&
    month <
      MAX_SIMULATION_MONTHS
  ) {
    capital =
      capital *
        (1 + monthlyRate) +
      monthlyContribution

    totalContributions =
      totalContributions +
      monthlyContribution

    month =
      month + 1

    if (
      month % 12 === 0 ||
      capital >= targetCapital
    ) {
      points.push({
        age:
          formatAge(
            currentAgeMonths +
              month
          ),

        ageMonths:
          currentAgeMonths +
          month,

        capital,

        contributions:
          totalContributions,
      })
    }
  }

  const estimatedDate =
    new Date()

  estimatedDate.setMonth(
    estimatedDate.getMonth() +
      month
  )

  const investmentGain =
    Math.max(
      capital -
        totalContributions,
      0
    )

  const gainShare =
    capital > 0
      ? (
          investmentGain /
          capital
        ) * 100
      : 0

  return {
    realReturn,

    months:
      month,

    targetReached:
      capital >= targetCapital,

    finalCapital:
      capital,

    totalContributions,

    investmentGain,

    gainShare,

    estimatedDate,

    fireAgeMonths:
      currentAgeMonths +
      month,

    points,
  }
}

function calculateRent(
  startCapital: number,
  startAgeMonths: number,
  monthlyRent: number,
  nominalReturn: number,
  inflation: number,
  years: number,
  pensionAge: number,
  pensionAmount: number,
  indexation: boolean,
  dynamic: boolean
) {
  const monthlyReturn =
    annualToMonthlyRate(
      nominalReturn
    )

  const monthlyInflation =
    annualToMonthlyRate(
      inflation
    )

  const totalMonths =
    Math.max(
      Math.round(
        years * 12
      ),
      1
    )

  let capital =
    Math.max(
      startCapital,
      0
    )

  let indexedRent =
    Math.max(
      monthlyRent,
      0
    )

  let indexedPension =
    Math.max(
      pensionAmount,
      0
    )

  let depletionMonth:
    number | null = null

  let totalWithdrawn = 0
  let totalPension = 0

  const initialSWR =
    startCapital > 0
      ? (
          monthlyRent *
          12 /
          startCapital
        ) * 100
      : 0

  const points:
    RentPoint[] = [
      {
        age:
          formatAge(
            startAgeMonths
          ),

        ageMonths:
          startAgeMonths,

        capital,

        monthlyWithdrawal:
          indexedRent,

        pension:
          0,
      },
    ]

  for (
    let month = 1;
    month <= totalMonths;
    month++
  ) {
    const currentAgeMonths =
      startAgeMonths +
      month

    const currentAge =
      currentAgeMonths /
      12

    if (
      indexation &&
      month > 1
    ) {
      indexedRent =
        indexedRent *
        (1 + monthlyInflation)

      indexedPension =
        indexedPension *
        (1 + monthlyInflation)
    }

    const pension =
      currentAge >= pensionAge
        ? indexedPension
        : 0

    let requiredWithdrawal =
      Math.max(
        indexedRent -
          pension,
        0
      )

    if (dynamic) {
      const annualRate =
        initialSWR / 100

      const dynamicRent =
        capital *
        annualRate /
        12

      requiredWithdrawal =
        Math.max(
          dynamicRent -
            pension,
          0
        )
    }

    capital =
      capital *
      (1 + monthlyReturn)

    capital =
      capital -
      requiredWithdrawal

    totalWithdrawn =
      totalWithdrawn +
      requiredWithdrawal

    totalPension =
      totalPension +
      pension

    if (capital <= 0) {
      capital = 0

      depletionMonth =
        month
    }

    if (
      month % 12 === 0 ||
      month === totalMonths ||
      depletionMonth !== null
    ) {
      points.push({
        age:
          formatAge(
            currentAgeMonths
          ),

        ageMonths:
          currentAgeMonths,

        capital,

        monthlyWithdrawal:
          requiredWithdrawal,

        pension,
      })
    }

    if (
      depletionMonth !== null
    ) {
      break
    }
  }

  return {
    initialSWR,

    sustainable:
      depletionMonth === null,

    depletionMonth,

    endingCapital:
      capital,

    endingAgeMonths:
      depletionMonth !== null
        ? startAgeMonths +
          depletionMonth
        : startAgeMonths +
          totalMonths,

    totalWithdrawn,

    totalPension,

    finalIndexedRent:
      indexedRent,

    points,
  }
}

export default function Fire() {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<FireTab>(
      'accumulation'
    )

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [
    snapshotDate,
    setSnapshotDate,
  ] = useState('')

  const [
    currentNetWorth,
    setCurrentNetWorth,
  ] = useState(0)

  const [
    currentAgeYears,
    setCurrentAgeYears,
  ] = useState('35')

  const [
    currentAgeMonths,
    setCurrentAgeMonths,
  ] = useState('0')

  const [
    annualExpenses,
    setAnnualExpenses,
  ] = useState('1320000')

  const [
    withdrawalRate,
    setWithdrawalRate,
  ] = useState('4')

  const [
    fireTarget,
    setFireTarget,
  ] = useState('25000000')

  const [
    monthlyContribution,
    setMonthlyContribution,
  ] = useState('80000')

  const [
    expectedReturn,
    setExpectedReturn,
  ] = useState('7')

  const [
    inflationRate,
    setInflationRate,
  ] = useState('2.5')

  const [
    rentStartAgeYears,
    setRentStartAgeYears,
  ] = useState('45')

  const [
    rentStartAgeMonths,
    setRentStartAgeMonths,
  ] = useState('0')

  const [
    rentStartCapital,
    setRentStartCapital,
  ] = useState('25000000')

  const [
    monthlyRent,
    setMonthlyRent,
  ] = useState('100000')

  const [
    rentReturnRate,
    setRentReturnRate,
  ] = useState('5')

  const [
    rentInflationRate,
    setRentInflationRate,
  ] = useState('2.5')

  const [
    rentYears,
    setRentYears,
  ] = useState('50')

  const [
    statePensionAge,
    setStatePensionAge,
  ] = useState('65')

  const [
    statePensionAmount,
    setStatePensionAmount,
  ] = useState('20000')

  const [
    rentIndexation,
    setRentIndexation,
  ] = useState(true)

  const [
    rentDynamic,
    setRentDynamic,
  ] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setMessage('')

        const [
          settings,
          netWorth,
        ] = await Promise.all([
          getFireSettings(),
          getCurrentNetWorth(),
        ])

        if (cancelled) {
          return
        }

        setCurrentNetWorth(
          netWorth.value
        )

        setSnapshotDate(
          netWorth.date
        )

        setCurrentAgeYears(
          String(
            settings
              .current_age_years
          )
        )

        setCurrentAgeMonths(
          String(
            settings
              .current_age_months
          )
        )

        setAnnualExpenses(
          String(
            settings
              .annual_expenses
          )
        )

        setWithdrawalRate(
          String(
            settings
              .withdrawal_rate *
              100
          )
        )

        setFireTarget(
          String(
            settings
              .target_fire_number
          )
        )

        setMonthlyContribution(
          String(
            settings
              .monthly_contribution
          )
        )

        setExpectedReturn(
          String(
            settings
              .expected_return *
              100
          )
        )

        setInflationRate(
          String(
            settings
              .inflation_rate *
              100
          )
        )

        setRentStartAgeYears(
          String(
            settings
              .rent_start_age_years
          )
        )

        setRentStartAgeMonths(
          String(
            settings
              .rent_start_age_months
          )
        )

        setRentStartCapital(
          String(
            settings
              .rent_start_capital
          )
        )

        setMonthlyRent(
          String(
            settings
              .monthly_rent
          )
        )

        setRentReturnRate(
          String(
            settings
              .rent_return_rate *
              100
          )
        )

        setRentInflationRate(
          String(
            settings
              .rent_inflation_rate *
              100
          )
        )

        setRentYears(
          String(
            settings
              .rent_years
          )
        )

        setStatePensionAge(
          String(
            settings
              .state_pension_age
          )
        )

        setStatePensionAmount(
          String(
            settings
              .state_pension_amount
          )
        )

        setRentIndexation(
          settings
            .rent_indexation
        )

        setRentDynamic(
          settings
            .rent_dynamic
        )
      } catch (error) {
        console.error(
          'FIRE:',
          error
        )

        if (!cancelled) {
          setMessage(
            'FIRE nastavení se nepodařilo načíst.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const values =
    useMemo(
      () => ({
        currentAgeYears:
          Math.max(
            Math.floor(
              parseNumber(
                currentAgeYears
              )
            ),
            0
          ),

        currentAgeMonths:
          Math.min(
            Math.max(
              Math.floor(
                parseNumber(
                  currentAgeMonths
                )
              ),
              0
            ),
            11
          ),

        annualExpenses:
          Math.max(
            parseNumber(
              annualExpenses
            ),
            0
          ),

        withdrawalRate:
          parseNumber(
            withdrawalRate
          ) / 100,

        fireTarget:
          Math.max(
            parseNumber(
              fireTarget
            ),
            0
          ),

        monthlyContribution:
          Math.max(
            parseNumber(
              monthlyContribution
            ),
            0
          ),

        expectedReturn:
          parseNumber(
            expectedReturn
          ) / 100,

        inflationRate:
          parseNumber(
            inflationRate
          ) / 100,

        rentStartAgeYears:
          Math.max(
            Math.floor(
              parseNumber(
                rentStartAgeYears
              )
            ),
            0
          ),

        rentStartAgeMonths:
          Math.min(
            Math.max(
              Math.floor(
                parseNumber(
                  rentStartAgeMonths
                )
              ),
              0
            ),
            11
          ),

        rentStartCapital:
          Math.max(
            parseNumber(
              rentStartCapital
            ),
            0
          ),

        monthlyRent:
          Math.max(
            parseNumber(
              monthlyRent
            ),
            0
          ),

        rentReturnRate:
          parseNumber(
            rentReturnRate
          ) / 100,

        rentInflationRate:
          parseNumber(
            rentInflationRate
          ) / 100,

        rentYears:
          Math.max(
            parseNumber(
              rentYears
            ),
            1
          ),

        statePensionAge:
          Math.max(
            parseNumber(
              statePensionAge
            ),
            0
          ),

        statePensionAmount:
          Math.max(
            parseNumber(
              statePensionAmount
            ),
            0
          ),
      }),
      [
        currentAgeYears,
        currentAgeMonths,
        annualExpenses,
        withdrawalRate,
        fireTarget,
        monthlyContribution,
        expectedReturn,
        inflationRate,
        rentStartAgeYears,
        rentStartAgeMonths,
        rentStartCapital,
        monthlyRent,
        rentReturnRate,
        rentInflationRate,
        rentYears,
        statePensionAge,
        statePensionAmount,
      ]
    )

  const currentAgeTotalMonths =
    values.currentAgeYears *
      12 +
    values.currentAgeMonths

  const rentStartAgeTotalMonths =
    values.rentStartAgeYears *
      12 +
    values.rentStartAgeMonths

  const accumulation =
    useMemo(
      () =>
        calculateAccumulation(
          currentNetWorth,
          values
            .monthlyContribution,
          values.fireTarget,
          values
            .expectedReturn,
          values
            .inflationRate,
          currentAgeTotalMonths
        ),
      [
        currentNetWorth,
        values
          .monthlyContribution,
        values.fireTarget,
        values
          .expectedReturn,
        values
          .inflationRate,
        currentAgeTotalMonths,
      ]
    )

  const rentProjection =
    useMemo(
      () =>
        calculateRent(
          values
            .rentStartCapital,

          rentStartAgeTotalMonths,

          values
            .monthlyRent,

          values
            .rentReturnRate,

          values
            .rentInflationRate,

          values.rentYears,

          values
            .statePensionAge,

          values
            .statePensionAmount,

          rentIndexation,

          rentDynamic
        ),
      [
        values
          .rentStartCapital,

        rentStartAgeTotalMonths,

        values
          .monthlyRent,

        values
          .rentReturnRate,

        values
          .rentInflationRate,

        values.rentYears,

        values
          .statePensionAge,

        values
          .statePensionAmount,

        rentIndexation,

        rentDynamic,
      ]
    )

  const fireProgress =
    values.fireTarget > 0
      ? (
          currentNetWorth /
          values.fireTarget
        ) * 100
      : 0

  const missingToTarget =
    Math.max(
      values.fireTarget -
        currentNetWorth,
      0
    )

  const modelFireTarget =
    values.withdrawalRate > 0
      ? values.annualExpenses /
        values.withdrawalRate
      : 0

  async function handleSave() {
    const settings:
      FireSettingsInput = {
        annual_expenses:
          values.annualExpenses,

        withdrawal_rate:
          values.withdrawalRate,

        target_fire_number:
          values.fireTarget,

        current_age_years:
          values.currentAgeYears,

        current_age_months:
          values.currentAgeMonths,

        monthly_contribution:
          values.monthlyContribution,

        expected_return:
          values.expectedReturn,

        inflation_rate:
          values.inflationRate,

        rent_start_age_years:
          values.rentStartAgeYears,

        rent_start_age_months:
          values.rentStartAgeMonths,

        rent_start_capital:
          values.rentStartCapital,

        monthly_rent:
          values.monthlyRent,

        rent_return_rate:
          values.rentReturnRate,

        rent_inflation_rate:
          values.rentInflationRate,

        rent_years:
          Math.round(
            values.rentYears
          ),

        state_pension_age:
          Math.round(
            values.statePensionAge
          ),

        state_pension_amount:
          values.statePensionAmount,

        rent_indexation:
          rentIndexation,

        rent_dynamic:
          rentDynamic,
      }

    try {
      setSaving(true)
      setMessage('')

      await saveFireSettings(
        settings
      )

      setMessage(
        'FIRE nastavení bylo uloženo.'
      )
    } catch (error) {
      console.error(
        'FIRE save:',
        error
      )

      setMessage(
        'FIRE nastavení se nepodařilo uložit.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám FIRE model...
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            FIRE
          </h1>

          <p className="page-subtitle">
            Model akumulace kapitálu
            a dlouhodobého čerpání
            renty.
          </p>
        </div>

        <button
          className="button-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? 'Ukládám...'
            : 'Uložit nastavení'}
        </button>
      </header>

      {message && (
        <StatusMessage
          message={message}
          error={
            message.includes(
              'nepodařilo'
            )
          }
        />
      )}

      <TabSelector
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab ===
        'accumulation' && (
        <AccumulationView
          currentNetWorth={
            currentNetWorth
          }
          snapshotDate={
            snapshotDate
          }
          fireProgress={
            fireProgress
          }
          missingToTarget={
            missingToTarget
          }
          accumulation={
            accumulation
          }
          modelFireTarget={
            modelFireTarget
          }
          values={values}
          currentAgeYears={
            currentAgeYears
          }
          setCurrentAgeYears={
            setCurrentAgeYears
          }
          currentAgeMonths={
            currentAgeMonths
          }
          setCurrentAgeMonths={
            setCurrentAgeMonths
          }
          monthlyContribution={
            monthlyContribution
          }
          setMonthlyContribution={
            setMonthlyContribution
          }
          fireTarget={
            fireTarget
          }
          setFireTarget={
            setFireTarget
          }
          expectedReturn={
            expectedReturn
          }
          setExpectedReturn={
            setExpectedReturn
          }
          inflationRate={
            inflationRate
          }
          setInflationRate={
            setInflationRate
          }
          annualExpenses={
            annualExpenses
          }
          setAnnualExpenses={
            setAnnualExpenses
          }
          withdrawalRate={
            withdrawalRate
          }
          setWithdrawalRate={
            setWithdrawalRate
          }
        />
      )}

      {activeTab ===
        'rent' && (
        <RentView
          projection={
            rentProjection
          }
          values={values}
          rentStartAgeYears={
            rentStartAgeYears
          }
          setRentStartAgeYears={
            setRentStartAgeYears
          }
          rentStartAgeMonths={
            rentStartAgeMonths
          }
          setRentStartAgeMonths={
            setRentStartAgeMonths
          }
          rentStartCapital={
            rentStartCapital
          }
          setRentStartCapital={
            setRentStartCapital
          }
          monthlyRent={
            monthlyRent
          }
          setMonthlyRent={
            setMonthlyRent
          }
          rentReturnRate={
            rentReturnRate
          }
          setRentReturnRate={
            setRentReturnRate
          }
          rentInflationRate={
            rentInflationRate
          }
          setRentInflationRate={
            setRentInflationRate
          }
          rentYears={
            rentYears
          }
          setRentYears={
            setRentYears
          }
          statePensionAge={
            statePensionAge
          }
          setStatePensionAge={
            setStatePensionAge
          }
          statePensionAmount={
            statePensionAmount
          }
          setStatePensionAmount={
            setStatePensionAmount
          }
          rentIndexation={
            rentIndexation
          }
          setRentIndexation={
            setRentIndexation
          }
          rentDynamic={
            rentDynamic
          }
          setRentDynamic={
            setRentDynamic
          }
        />
      )}
    </div>
  )
}

function AccumulationView({
  currentNetWorth,
  snapshotDate,
  fireProgress,
  missingToTarget,
  accumulation,
  modelFireTarget,
  values,
  currentAgeYears,
  setCurrentAgeYears,
  currentAgeMonths,
  setCurrentAgeMonths,
  monthlyContribution,
  setMonthlyContribution,
  fireTarget,
  setFireTarget,
  expectedReturn,
  setExpectedReturn,
  inflationRate,
  setInflationRate,
  annualExpenses,
  setAnnualExpenses,
  withdrawalRate,
  setWithdrawalRate,
}: {
  currentNetWorth: number
  snapshotDate: string
  fireProgress: number
  missingToTarget: number

  accumulation:
    ReturnType<
      typeof calculateAccumulation
    >

  modelFireTarget: number

  values: {
    fireTarget: number
    monthlyContribution: number
    expectedReturn: number
    inflationRate: number
  }

  currentAgeYears: string

  setCurrentAgeYears:
    (value: string) => void

  currentAgeMonths: string

  setCurrentAgeMonths:
    (value: string) => void

  monthlyContribution:
    string

  setMonthlyContribution:
    (value: string) => void

  fireTarget: string

  setFireTarget:
    (value: string) => void

  expectedReturn:
    string

  setExpectedReturn:
    (value: string) => void

  inflationRate:
    string

  setInflationRate:
    (value: string) => void

  annualExpenses:
    string

  setAnnualExpenses:
    (value: string) => void

  withdrawalRate:
    string

  setWithdrawalRate:
    (value: string) => void
}) {
  return (
    <>
      <SectionHeading
        title="Akumulační fáze"
        description="Odhad vývoje kapitálu do dosažení cílové hodnoty v dnešních cenách."
      />

      <section className="kpi-grid">
        <MetricCard
          label="Aktuální majetek"
          value={formatCompactMoney(
            currentNetWorth
          )}
          description={
            snapshotDate
              ? `Snapshot ${snapshotDate}`
              : formatMoney(
                  currentNetWorth
                )
          }
        />

        <MetricCard
          label="FIRE cíl"
          value={formatCompactMoney(
            values.fireTarget
          )}
          description={formatMoney(
            values.fireTarget
          )}
        />

        <MetricCard
          label="FIRE progress"
          value={formatPercent(
            fireProgress,
            1
          )}
          description={`Chybí ${formatCompactMoney(
            missingToTarget
          )}`}
        />

        <MetricCard
          label="Odhad dosažení"
          value={
            accumulation
              .targetReached
              ? formatDate(
                  accumulation
                    .estimatedDate
                )
              : 'Nedosaženo'
          }
          description={
            accumulation
              .targetReached
              ? formatAge(
                  accumulation
                    .fireAgeMonths
                )
              : 'Více než 100 let'
          }
        />

        <MetricCard
          label="Reálný výnos"
          value={formatPercent(
            accumulation
              .realReturn *
              100,
            2
          )}
          description="Nominální výnos po inflaci"
        />

        <MetricCard
          label="Měsíční investice"
          value={formatMoney(
            values
              .monthlyContribution
          )}
          description="Pravidelný externí vklad"
        />

        <MetricCard
          label="Vlastní prostředky"
          value={formatCompactMoney(
            accumulation
              .totalContributions
          )}
          description="Počáteční kapitál a další vklady"
        />

        <MetricCard
          label="Podíl výnosů"
          value={formatPercent(
            accumulation
              .gainShare,
            1
          )}
          description={formatMoney(
            accumulation
              .investmentGain
          )}
        />
      </section>

      <div className="fire-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Parametry
              </h2>

              <div className="panel-subtitle">
                Modelovací předpoklady
                akumulační fáze
              </div>
            </div>
          </div>

          <div className="panel-body">
            <div className="fire-two-fields">
              <Field
                label="Současný věk"
              >
                <input
                  className="form-control"
                  type="number"
                  min="18"
                  max="100"
                  value={
                    currentAgeYears
                  }
                  onChange={(event) =>
                    setCurrentAgeYears(
                      event.target
                        .value
                    )
                  }
                />
              </Field>

              <Field
                label="Měsíce"
              >
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="11"
                  value={
                    currentAgeMonths
                  }
                  onChange={(event) =>
                    setCurrentAgeMonths(
                      event.target
                        .value
                    )
                  }
                />
              </Field>
            </div>

            <ReadOnlyField
              label="Aktuální kapitál"
              value={formatMoney(
                currentNetWorth
              )}
            />

            <EditableRange
              label="Měsíční investice"
              value={
                monthlyContribution
              }
              onChange={
                setMonthlyContribution
              }
              min={0}
              max={300000}
              step={5000}
              suffix="Kč"
            />

            <EditableRange
              label="Cílový FIRE kapitál"
              value={
                fireTarget
              }
              onChange={
                setFireTarget
              }
              min={5000000}
              max={80000000}
              step={500000}
              suffix="Kč"
            />

            <div className="fire-two-fields">
              <Field
                label="Výnos p.a."
              >
                <PercentInput
                  value={
                    expectedReturn
                  }
                  onChange={
                    setExpectedReturn
                  }
                />
              </Field>

              <Field
                label="Inflace p.a."
              >
                <PercentInput
                  value={
                    inflationRate
                  }
                  onChange={
                    setInflationRate
                  }
                />
              </Field>
            </div>

            <div className="fire-two-fields">
              <Field
                label="Roční výdaje"
              >
                <input
                  className="form-control"
                  value={
                    annualExpenses
                  }
                  onChange={(event) =>
                    setAnnualExpenses(
                      event.target
                        .value
                    )
                  }
                  inputMode="decimal"
                />
              </Field>

              <Field
                label="SWR"
              >
                <PercentInput
                  value={
                    withdrawalRate
                  }
                  onChange={
                    setWithdrawalRate
                  }
                />
              </Field>
            </div>

            <div className="fire-note">
              Modelový cíl podle
              výdajů a SWR

              <strong>
                {formatMoney(
                  modelFireTarget
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Projekce kapitálu
              </h2>

              <div className="panel-subtitle">
                Reálné hodnoty po
                zohlednění inflace
              </div>
            </div>
          </div>

          <div className="panel-body">
            <ResponsiveContainer
              width="100%"
              height={460}
            >
              <LineChart
                data={
                  accumulation
                    .points
                }
                margin={{
                  top: 10,
                  right: 20,
                  bottom: 5,
                  left: 5,
                }}
              >
                <CartesianGrid
                  stroke="#eef0f3"
                  vertical={false}
                />

                <XAxis
                  dataKey="age"
                  minTickGap={35}
                  tick={chartTick}
                  axisLine={{
                    stroke:
                      '#e4e7ec',
                  }}
                  tickLine={false}
                />

                <YAxis
                  width={72}
                  tickFormatter={(
                    value
                  ) =>
                    `${(
                      Number(value) /
                      1000000
                    ).toLocaleString(
                      'cs-CZ',
                      {
                        maximumFractionDigits:
                          1,
                      }
                    )} mil.`
                  }
                  tick={chartTick}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  content={
                    <AccumulationTooltip />
                  }
                />

                <Legend
                  formatter={(
                    value
                  ) =>
                    value ===
                    'capital'
                      ? 'Kapitál'
                      : 'Vlastní prostředky'
                  }
                  wrapperStyle={{
                    fontSize:
                      '12px',

                    color:
                      '#667085',
                  }}
                />

                <ReferenceLine
                  y={
                    values
                      .fireTarget
                  }
                  stroke="#a64b4b"
                  strokeDasharray="5 5"
                  label={{
                    value:
                      'FIRE cíl',

                    fill:
                      '#8a5151',

                    fontSize:
                      11,
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="capital"
                  stroke="#53657d"
                  strokeWidth={2.4}
                  dot={false}
                />

                <Line
                  type="monotone"
                  dataKey="contributions"
                  stroke="#aab1bc"
                  strokeWidth={1.7}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>

            <div className="fire-chart-note">
              Projekce používá
              očekávaný reálný výnos.
              Skutečný vývoj bude záviset
              na tržní volatilitě a
              načasování výnosů.
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

function RentView({
  projection,
  values,
  rentStartAgeYears,
  setRentStartAgeYears,
  rentStartAgeMonths,
  setRentStartAgeMonths,
  rentStartCapital,
  setRentStartCapital,
  monthlyRent,
  setMonthlyRent,
  rentReturnRate,
  setRentReturnRate,
  rentInflationRate,
  setRentInflationRate,
  rentYears,
  setRentYears,
  statePensionAge,
  setStatePensionAge,
  statePensionAmount,
  setStatePensionAmount,
  rentIndexation,
  setRentIndexation,
  rentDynamic,
  setRentDynamic,
}: {
  projection:
    ReturnType<
      typeof calculateRent
    >

  values: {
    rentStartCapital: number
    monthlyRent: number
    rentReturnRate: number
    rentInflationRate: number
    rentYears: number
    statePensionAge: number
    statePensionAmount: number
  }

  rentStartAgeYears:
    string

  setRentStartAgeYears:
    (value: string) => void

  rentStartAgeMonths:
    string

  setRentStartAgeMonths:
    (value: string) => void

  rentStartCapital:
    string

  setRentStartCapital:
    (value: string) => void

  monthlyRent:
    string

  setMonthlyRent:
    (value: string) => void

  rentReturnRate:
    string

  setRentReturnRate:
    (value: string) => void

  rentInflationRate:
    string

  setRentInflationRate:
    (value: string) => void

  rentYears:
    string

  setRentYears:
    (value: string) => void

  statePensionAge:
    string

  setStatePensionAge:
    (value: string) => void

  statePensionAmount:
    string

  setStatePensionAmount:
    (value: string) => void

  rentIndexation:
    boolean

  setRentIndexation:
    (value: boolean) => void

  rentDynamic:
    boolean

  setRentDynamic:
    (value: boolean) => void
}) {
  const resultTone:
    Tone =
      projection.sustainable
        ? 'positive'
        : 'negative'

  const durationText =
    projection.sustainable
      ? `${Math.round(
          values.rentYears
        )}+ let`
      : `${Math.floor(
          (
            projection
              .depletionMonth ??
            0
          ) / 12
        )} let ${
          (
            projection
              .depletionMonth ??
            0
          ) % 12
        } měs.`

  return (
    <>
      <SectionHeading
        title="Rentová fáze"
        description="Simulace dlouhodobého čerpání kapitálu, státního důchodu a inflační indexace."
      />

      <section className="kpi-grid">
        <MetricCard
          label="Počáteční kapitál"
          value={formatCompactMoney(
            values
              .rentStartCapital
          )}
          description={formatMoney(
            values
              .rentStartCapital
          )}
        />

        <MetricCard
          label="Požadovaná renta"
          value={formatMoney(
            values.monthlyRent
          )}
          description="Měsíční částka na začátku"
        />

        <MetricCard
          label="Počáteční SWR"
          value={formatPercent(
            projection
              .initialSWR,
            2
          )}
          description="Renta vůči kapitálu"
        />

        <MetricCard
          label="Výdrž kapitálu"
          value={durationText}
          description={
            projection.sustainable
              ? 'Kapitál nebyl během období vyčerpán'
              : `Vyčerpání ve věku ${formatAge(
                  projection
                    .endingAgeMonths
                )}`
          }
          tone={resultTone}
        />

        <MetricCard
          label="Konečný kapitál"
          value={formatCompactMoney(
            projection
              .endingCapital
          )}
          description={formatMoney(
            projection
              .endingCapital
          )}
          tone={resultTone}
        />

        <MetricCard
          label="Čerpáno z portfolia"
          value={formatCompactMoney(
            projection
              .totalWithdrawn
          )}
          description={formatMoney(
            projection
              .totalWithdrawn
          )}
        />

        <MetricCard
          label="Státní důchod"
          value={formatCompactMoney(
            projection
              .totalPension
          )}
          description="Celkem za modelované období"
        />

        <MetricCard
          label="Věk na konci"
          value={formatAge(
            projection
              .endingAgeMonths
          )}
          description={`${Math.round(
            values.rentYears
          )} let modelovaného období`}
        />
      </section>

      <div className="fire-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Parametry
              </h2>

              <div className="panel-subtitle">
                Nastavení rentové fáze
              </div>
            </div>
          </div>

          <div className="panel-body">
            <div className="fire-two-fields">
              <Field
                label="Věk začátku"
              >
                <input
                  className="form-control"
                  type="number"
                  value={
                    rentStartAgeYears
                  }
                  onChange={(event) =>
                    setRentStartAgeYears(
                      event.target
                        .value
                    )
                  }
                />
              </Field>

              <Field
                label="Měsíce"
              >
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="11"
                  value={
                    rentStartAgeMonths
                  }
                  onChange={(event) =>
                    setRentStartAgeMonths(
                      event.target
                        .value
                    )
                  }
                />
              </Field>
            </div>

            <EditableRange
              label="Počáteční kapitál"
              value={
                rentStartCapital
              }
              onChange={
                setRentStartCapital
              }
              min={1000000}
              max={80000000}
              step={500000}
              suffix="Kč"
            />

            <EditableRange
              label="Měsíční renta"
              value={
                monthlyRent
              }
              onChange={
                setMonthlyRent
              }
              min={10000}
              max={300000}
              step={5000}
              suffix="Kč"
            />

            <div className="fire-two-fields">
              <Field
                label="Výnos p.a."
              >
                <PercentInput
                  value={
                    rentReturnRate
                  }
                  onChange={
                    setRentReturnRate
                  }
                />
              </Field>

              <Field
                label="Inflace p.a."
              >
                <PercentInput
                  value={
                    rentInflationRate
                  }
                  onChange={
                    setRentInflationRate
                  }
                />
              </Field>
            </div>

            <Field
              label="Délka modelu v letech"
            >
              <input
                className="form-control"
                type="number"
                min="1"
                max="100"
                value={
                  rentYears
                }
                onChange={(event) =>
                  setRentYears(
                    event.target
                      .value
                  )
                }
              />
            </Field>

            <div className="fire-subheading">
              Státní důchod
            </div>

            <div className="fire-two-fields">
              <Field
                label="Věk nároku"
              >
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  max="100"
                  value={
                    statePensionAge
                  }
                  onChange={(event) =>
                    setStatePensionAge(
                      event.target
                        .value
                    )
                  }
                />
              </Field>

              <Field
                label="Měsíční důchod"
              >
                <input
                  className="form-control"
                  value={
                    statePensionAmount
                  }
                  onChange={(event) =>
                    setStatePensionAmount(
                      event.target
                        .value
                    )
                  }
                  inputMode="decimal"
                />
              </Field>
            </div>

            <CheckboxRow
              label="Indexovat rentu a důchod inflací"
              checked={
                rentIndexation
              }
              onChange={
                setRentIndexation
              }
            />

            <CheckboxRow
              label="Dynamické čerpání podle aktuálního kapitálu"
              checked={
                rentDynamic
              }
              onChange={
                setRentDynamic
              }
            />

            <div className="fire-note">
              Dynamické čerpání upravuje
              měsíční výběr podle
              aktuálního kapitálu a
              počátečního SWR.
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Vývoj kapitálu
              </h2>

              <div className="panel-subtitle">
                Nominální hodnota podle věku
              </div>
            </div>
          </div>

          <div className="panel-body">
            <ResponsiveContainer
              width="100%"
              height={460}
            >
              <LineChart
                data={
                  projection.points
                }
                margin={{
                  top: 10,
                  right: 20,
                  bottom: 5,
                  left: 5,
                }}
              >
                <CartesianGrid
                  stroke="#eef0f3"
                  vertical={false}
                />

                <XAxis
                  dataKey="age"
                  minTickGap={35}
                  tick={chartTick}
                  axisLine={{
                    stroke:
                      '#e4e7ec',
                  }}
                  tickLine={false}
                />

                <YAxis
                  width={72}
                  tickFormatter={(
                    value
                  ) =>
                    `${(
                      Number(value) /
                      1000000
                    ).toLocaleString(
                      'cs-CZ',
                      {
                        maximumFractionDigits:
                          1,
                      }
                    )} mil.`
                  }
                  tick={chartTick}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  content={
                    <RentTooltip />
                  }
                />

                <ReferenceLine
                  y={0}
                  stroke="#a64b4b"
                />

                <Line
                  type="monotone"
                  dataKey="capital"
                  stroke="#53657d"
                  strokeWidth={2.4}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>

            <div
              className={
                projection.sustainable
                  ? 'fire-result fire-result-positive'
                  : 'fire-result fire-result-negative'
              }
            >
              {projection.sustainable
                ? `Po ${Math.round(
                    values.rentYears
                  )} letech model stále drží ${formatMoney(
                    projection
                      .endingCapital
                  )}.`
                : `Kapitál se vyčerpá ve věku ${formatAge(
                    projection
                      .endingAgeMonths
                  )}.`}
            </div>

            <div className="fire-chart-note">
              Simulace je deterministická.
              Nezohledňuje kolísání výnosů,
              daně, poplatky ani sequence-of-returns
              risk.
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="fire-section-heading">
      <h2>{title}</h2>

      <p>{description}</p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  description,
  tone = 'default',
}: {
  label: string
  value: string
  description?: string
  tone?: Tone
}) {
  const valueClass =
    tone === 'positive'
      ? 'positive'
      : tone === 'negative'
        ? 'negative'
        : ''

  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {label}
      </div>

      <div
        className={`kpi-value ${valueClass}`}
      >
        {value}
      </div>

      {description && (
        <div className="kpi-description">
          {description}
        </div>
      )}
    </div>
  )
}

function TabSelector({
  value,
  onChange,
}: {
  value: FireTab
  onChange:
    (value: FireTab) => void
}) {
  return (
    <div className="fire-tabs">
      <button
        className={
          value ===
          'accumulation'
            ? 'fire-tab fire-tab-active'
            : 'fire-tab'
        }
        onClick={() =>
          onChange(
            'accumulation'
          )
        }
      >
        Akumulace FIRE
      </button>

      <button
        className={
          value === 'rent'
            ? 'fire-tab fire-tab-active'
            : 'fire-tab'
        }
        onClick={() =>
          onChange('rent')
        }
      >
        Simulátor renty
      </button>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="fire-field">
      <label className="form-label">
        {label}
      </label>

      {children}
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <Field label={label}>
      <input
        className="form-control"
        value={value}
        readOnly
      />
    </Field>
  )
}

function PercentInput({
  value,
  onChange,
}: {
  value: string
  onChange:
    (value: string) => void
}) {
  return (
    <div className="fire-input-suffix">
      <input
        className="form-control"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        inputMode="decimal"
      />

      <span>%</span>
    </div>
  )
}

function EditableRange({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string
  value: string
  onChange:
    (value: string) => void
  min: number
  max: number
  step: number
  suffix?: string
}) {
  const numericValue =
    parseNumber(value)

  const rangeValue =
    Math.min(
      Math.max(
        numericValue,
        min
      ),
      max
    )

  return (
    <div className="fire-range-field">
      <label className="form-label">
        {label}
      </label>

      <div className="fire-input-suffix">
        <input
          className="form-control"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          inputMode="decimal"
        />

        {suffix && (
          <span>{suffix}</span>
        )}
      </div>

      <input
        className="fire-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={rangeValue}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      />

      <div className="fire-range-labels">
        <span>
          {formatCompactMoney(
            min
          )}
        </span>

        <span>
          {formatCompactMoney(
            max
          )}
        </span>
      </div>
    </div>
  )
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange:
    (value: boolean) => void
}) {
  return (
    <label className="fire-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
      />

      <span>{label}</span>
    </label>
  )
}

function StatusMessage({
  message,
  error = false,
}: {
  message: string
  error?: boolean
}) {
  return (
    <div
      className={
        error
          ? 'fire-status fire-status-error'
          : 'fire-status'
      }
    >
      {message}
    </div>
  )
}

function AccumulationTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{
    dataKey?: string
    value?: number
  }>
  label?: string
}) {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null
  }

  const capital =
    payload.find(
      (item) =>
        item.dataKey ===
        'capital'
    )?.value

  const contributions =
    payload.find(
      (item) =>
        item.dataKey ===
        'contributions'
    )?.value

  return (
    <ChartTooltip
      title={`Věk ${label ?? ''}`}
      rows={[
        {
          label: 'Kapitál',
          value:
            capital !==
            undefined
              ? formatMoney(
                  Number(
                    capital
                  )
                )
              : '—',
        },
        {
          label:
            'Vlastní prostředky',
          value:
            contributions !==
            undefined
              ? formatMoney(
                  Number(
                    contributions
                  )
                )
              : '—',
        },
      ]}
    />
  )
}

function RentTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{
    payload?: RentPoint
  }>
  label?: string
}) {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null
  }

  const row =
    payload[0].payload

  if (!row) {
    return null
  }

  return (
    <ChartTooltip
      title={`Věk ${label ?? ''}`}
      rows={[
        {
          label: 'Kapitál',
          value:
            formatMoney(
              row.capital
            ),
        },
        {
          label:
            'Měsíční čerpání',
          value:
            formatMoney(
              row.monthlyWithdrawal
            ),
        },
        {
          label:
            'Měsíční důchod',
          value:
            formatMoney(
              row.pension
            ),
        },
      ]}
    />
  )
}

function ChartTooltip({
  title,
  rows,
}: {
  title: string
  rows: Array<{
    label: string
    value: string
  }>
}) {
  return (
    <div className="fire-tooltip">
      <div className="fire-tooltip-title">
        {title}
      </div>

      {rows.map(
        (row) => (
          <div
            key={row.label}
            className="fire-tooltip-row"
          >
            <span>
              {row.label}
            </span>

            <strong>
              {row.value}
            </strong>
          </div>
        )
      )}
    </div>
  )
}

const chartTick = {
  fill: '#98a2b3',
  fontSize: 11,
}