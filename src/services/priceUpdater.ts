import { supabase } from '../lib/supabase'

import {
  saveTodaySnapshot,
} from './netWorth'

const MARKET_SYNC_KEY =
  'market_prices'

export type UpdatedPrice = {
  name: string
  ticker: string
  price: number
  currency: string
  fxRate: number
  priceDate: string
}

export type PriceUpdateError = {
  name: string
  ticker: string
  error: string
}

export type PriceUpdateResult = {
  ok: boolean

  fx?: {
    date: string
    USDCZK: number
    EURCZK: number
  }

  processed: number
  updatedCount: number
  errorCount: number

  updated: UpdatedPrice[]

  errors: PriceUpdateError[]

  snapshot?: {
    date: string
    netWorth: number
    assets: number
    liabilities: number
  }
}

export type PriceUpdateStatus = {
  lastSuccessDate:
    | string
    | null

  lastSuccessAt:
    | string
    | null

  processed: number
  updatedCount: number
  errorCount: number
}

function getToday() {
  return new Date()
    .toISOString()
    .slice(0, 10)
}

function normalizeNumber(
  value: unknown
) {
  const number =
    Number(value)

  return Number.isFinite(number)
    ? number
    : 0
}

export async function getPriceUpdateStatus():
  Promise<PriceUpdateStatus> {
  const { data, error } =
    await supabase
      .from('app_sync_status')
      .select(`
        last_success_date,
        last_success_at,
        processed,
        updated_count,
        error_count
      `)
      .eq(
        'sync_key',
        MARKET_SYNC_KEY
      )
      .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return {
      lastSuccessDate:
        null,

      lastSuccessAt:
        null,

      processed:
        0,

      updatedCount:
        0,

      errorCount:
        0,
    }
  }

  return {
    lastSuccessDate:
      data.last_success_date,

    lastSuccessAt:
      data.last_success_at,

    processed:
      normalizeNumber(
        data.processed
      ),

    updatedCount:
      normalizeNumber(
        data.updated_count
      ),

    errorCount:
      normalizeNumber(
        data.error_count
      ),
  }
}

export async function pricesUpdatedToday() {
  const status =
    await getPriceUpdateStatus()

  return (
    status.lastSuccessDate ===
    getToday()
  )
}

async function savePriceUpdateStatus(
  result: PriceUpdateResult
) {
  const now =
    new Date()
      .toISOString()

  const today =
    getToday()

  const { error } =
    await supabase
      .from('app_sync_status')
      .upsert(
        {
          sync_key:
            MARKET_SYNC_KEY,

          last_success_date:
            today,

          last_success_at:
            now,

          processed:
            result.processed,

          updated_count:
            result.updatedCount,

          error_count:
            result.errorCount,

          details: {
            ok:
              result.ok,

            fx:
              result.fx ??
              null,

            errors:
              result.errors ??
              [],
          },

          updated_at:
            now,
        },
        {
          onConflict:
            'sync_key',
        }
      )

  if (error) {
    throw error
  }
}

export async function updateMarketPrices():
  Promise<PriceUpdateResult> {
  const {
    data,
    error,
  } =
    await supabase
      .functions
      .invoke(
        'update-prices',
        {
          body: {},
        }
      )

  if (error) {
    throw error
  }

  const result =
    data as PriceUpdateResult

  if (
    !result ||
    typeof result !==
      'object'
  ) {
    throw new Error(
      'Edge Function vrátila neplatnou odpověď.'
    )
  }

  if (
    !Number.isFinite(
      Number(
        result.processed
      )
    ) ||
    !Number.isFinite(
      Number(
        result.updatedCount
      )
    )
  ) {
    throw new Error(
      'Odpověď aktualizace neobsahuje platné statistiky.'
    )
  }

  /*
   * Snapshot vytváříme, pokud Edge Function
   * úspěšně přecenila alespoň jeden instrument.
   *
   * Upsert v saveTodaySnapshot zajistí,
   * že je v databázi pouze jeden snapshot
   * za portfolio a den.
   */
  if (
    result.updatedCount > 0
  ) {
    const snapshot =
      await saveTodaySnapshot()

    result.snapshot =
      snapshot
  }

  /*
   * Synchronizaci považujeme za provedenou,
   * pokud Edge Function doběhla a alespoň
   * jeden instrument aktualizovala.
   *
   * Dílčí chyby se ukládají do error_count,
   * ale aplikace nebude update během stejného
   * dne automaticky opakovat při každém otevření.
   */
  if (
    result.updatedCount > 0
  ) {
    await savePriceUpdateStatus(
      result
    )
  }

  return result
}