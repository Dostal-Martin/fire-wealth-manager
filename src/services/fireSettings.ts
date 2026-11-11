import { supabase } from '../lib/supabase'

import {
  getCurrentNetWorth as getLiveNetWorth,
  getLocalDateString,
} from './netWorth'

const PORTFOLIO_ID =
  '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

export type FireSettings = {
  portfolio_id: string

  annual_expenses: number
  withdrawal_rate: number
  target_fire_number: number

  current_age_years: number
  current_age_months: number

  monthly_contribution: number
  expected_return: number
  inflation_rate: number

  rent_start_age_years: number
  rent_start_age_months: number
  rent_start_capital: number

  monthly_rent: number
  rent_return_rate: number
  rent_inflation_rate: number
  rent_years: number

  state_pension_age: number
  state_pension_amount: number

  rent_indexation: boolean
  rent_dynamic: boolean
}

export type FireSettingsInput =
  Omit<
    FireSettings,
    'portfolio_id'
  >

function toNumber(
  value: unknown,
  fallback = 0
) {
  const number =
    Number(value)

  return Number.isFinite(number)
    ? number
    : fallback
}

export async function getFireSettings():
  Promise<FireSettings> {
  const {
    data,
    error,
  } =
    await supabase
      .from('fire_settings')
      .select(`
        portfolio_id,
        annual_expenses,
        withdrawal_rate,
        target_fire_number,
        current_age_years,
        current_age_months,
        monthly_contribution,
        expected_return,
        inflation_rate,
        rent_start_age_years,
        rent_start_age_months,
        rent_start_capital,
        monthly_rent,
        rent_return_rate,
        rent_inflation_rate,
        rent_years,
        state_pension_age,
        state_pension_amount,
        rent_indexation,
        rent_dynamic
      `)
      .eq(
        'portfolio_id',
        PORTFOLIO_ID
      )
      .single()

  if (error) {
    throw error
  }

  return {
    portfolio_id:
      data.portfolio_id,

    annual_expenses:
      toNumber(
        data.annual_expenses,
        1320000
      ),

    withdrawal_rate:
      toNumber(
        data.withdrawal_rate,
        0.04
      ),

    target_fire_number:
      toNumber(
        data.target_fire_number,
        25000000
      ),

    current_age_years:
      toNumber(
        data.current_age_years,
        35
      ),

    current_age_months:
      toNumber(
        data.current_age_months,
        0
      ),

    monthly_contribution:
      toNumber(
        data.monthly_contribution,
        80000
      ),

    expected_return:
      toNumber(
        data.expected_return,
        0.07
      ),

    inflation_rate:
      toNumber(
        data.inflation_rate,
        0.025
      ),

    rent_start_age_years:
      toNumber(
        data.rent_start_age_years,
        45
      ),

    rent_start_age_months:
      toNumber(
        data.rent_start_age_months,
        0
      ),

    rent_start_capital:
      toNumber(
        data.rent_start_capital,
        25000000
      ),

    monthly_rent:
      toNumber(
        data.monthly_rent,
        100000
      ),

    rent_return_rate:
      toNumber(
        data.rent_return_rate,
        0.05
      ),

    rent_inflation_rate:
      toNumber(
        data.rent_inflation_rate,
        0.025
      ),

    rent_years:
      toNumber(
        data.rent_years,
        50
      ),

    state_pension_age:
      toNumber(
        data.state_pension_age,
        65
      ),

    state_pension_amount:
      toNumber(
        data.state_pension_amount,
        20000
      ),

    rent_indexation:
      Boolean(
        data.rent_indexation
      ),

    rent_dynamic:
      Boolean(
        data.rent_dynamic
      ),
  }
}

export async function saveFireSettings(
  settings: FireSettingsInput
) {
  const {
    error,
  } =
    await supabase
      .from('fire_settings')
      .update({
        annual_expenses:
          settings.annual_expenses,

        withdrawal_rate:
          settings.withdrawal_rate,

        target_fire_number:
          settings.target_fire_number,

        current_age_years:
          settings.current_age_years,

        current_age_months:
          settings.current_age_months,

        monthly_contribution:
          settings.monthly_contribution,

        expected_return:
          settings.expected_return,

        inflation_rate:
          settings.inflation_rate,

        rent_start_age_years:
          settings.rent_start_age_years,

        rent_start_age_months:
          settings.rent_start_age_months,

        rent_start_capital:
          settings.rent_start_capital,

        monthly_rent:
          settings.monthly_rent,

        rent_return_rate:
          settings.rent_return_rate,

        rent_inflation_rate:
          settings.rent_inflation_rate,

        rent_years:
          Math.round(
            settings.rent_years
          ),

        state_pension_age:
          Math.round(
            settings.state_pension_age
          ),

        state_pension_amount:
          settings.state_pension_amount,

        rent_indexation:
          settings.rent_indexation,

        rent_dynamic:
          settings.rent_dynamic,
      })
      .eq(
        'portfolio_id',
        PORTFOLIO_ID
      )

  if (error) {
    throw error
  }
}

export async function getCurrentNetWorth() {
  const live =
    await getLiveNetWorth()

  return {
    date:
      getLocalDateString(),

    value:
      live.netWorth,

    assets:
      live.assets,

    liabilities:
      live.liabilities,
  }
}