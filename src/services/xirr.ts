import {
  supabase,
} from '../lib/supabase'

import {
  calculateXirr,
  type XirrCashflow,
} from '../domain/xirrCalculations'

import {
  getCurrentNetWorth,
  getLocalDateString,
} from './netWorth'

type ExternalCashflowRow = {
  transaction_date: string
  amount_czk:
    | number
    | string
}

/**
 * XIRR měří výnos kapitálu investora.
 *
 * Do výpočtu proto vstupují pouze cashflow,
 * která překročila hranici sledovaného
 * majetku:
 *
 * DEPOSIT / externí vklad
 * WITHDRAWAL / externí výběr
 *
 * Interní operace jako BUY, SELL,
 * dividenda, kupón, úrok, poplatek
 * nebo daň nejsou vstupem XIRR.
 *
 * Databázová konvence FIRE WM:
 *
 * + amount_czk = peníze vstupují
 *                do portfolia
 *
 * - amount_czk = peníze opouštějí
 *                portfolio
 *
 * Pro XIRR se na cashflow díváme
 * z perspektivy investora, takže
 * znaménko obracíme:
 *
 * DEPOSIT    -> záporný tok investora
 * WITHDRAWAL -> kladný tok investora
 *
 * Aktuální hodnota portfolia je
 * závěrečný kladný tok.
 */
export async function getXirr():
  Promise<number | null> {
  const {
    data,
    error,
  } =
    await supabase
      .from('cashflows')
      .select(`
        transaction_date,
        amount_czk
      `)
      .eq(
        'is_external',
        true
      )
      .order(
        'transaction_date',
        {
          ascending: true,
        }
      )

  if (error) {
    throw error
  }

  const externalCashflows =
    (
      data ?? []
    ) as ExternalCashflowRow[]

  /*
   * Bez historicky evidovaného externího
   * cashflow XIRR nemá ekonomický význam.
   *
   * BUY/SELL zde úmyslně nepoužíváme
   * jako náhradu externích vkladů.
   */
  if (
    externalCashflows.length ===
    0
  ) {
    return null
  }

  const flows:
    XirrCashflow[] =
      externalCashflows
        .map(
          (item) => {
            const amount =
              Number(
                item.amount_czk
              )

            return {
              date:
                item.transaction_date,

              amount:
                -amount,
            }
          }
        )
        .filter(
          (flow) =>
            Boolean(
              flow.date
            ) &&
            Number.isFinite(
              flow.amount
            ) &&
            flow.amount !==
              0
        )

  if (
    flows.length === 0
  ) {
    return null
  }

  const current =
    await getCurrentNetWorth()

  if (
    !Number.isFinite(
      current.netWorth
    ) ||
    current.netWorth <= 0
  ) {
    return null
  }

  flows.push({
    date:
      getLocalDateString(),

    amount:
      current.netWorth,
  })

  const result =
    calculateXirr(
      flows
    )

  if (
    result === null ||
    !Number.isFinite(
      result
    )
  ) {
    return null
  }

  return result * 100
}