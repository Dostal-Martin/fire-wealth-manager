import { supabase } from '../lib/supabase'

import {
  saveTodaySnapshot,
} from './netWorth'

const MARKET_SYNC_KEY =
  'market_prices'

export type MarketFx = {
  date: string
  USDCZK: number
  EURCZK: number
}

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

  fx?: MarketFx

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

export type MarketSyncState = {
  status: PriceUpdateStatus

  fx:
    | MarketFx
    | null
}

function getToday() {
  const date =
    new Date()

  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0')

  const day =
    String(
      date.getDate()
    ).padStart(2, '0')

  return `${year}-${month}-${day}`
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

function normalizeFx(
  value: unknown
):
  | MarketFx
  | null {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return null
  }

  const candidate =
    value as Record<
      string,
      unknown
    >

  const date =
    typeof candidate.date ===
    'string'
      ? candidate.date
      : ''

  const USDCZK =
    Number(
      candidate.USDCZK
    )

  const EURCZK =
    Number(
      candidate.EURCZK
    )

  if (
    !date ||
    !Number.isFinite(
      USDCZK
    ) ||
    !Number.isFinite(
      EURCZK
    )
  ) {
    return null
  }

  return {
    date,
    USDCZK,
    EURCZK,
  }
}

export async function getMarketSyncState():
  Promise<MarketSyncState> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'app_sync_status'
      )
      .select(`
        last_success_date,
        last_success_at,
        processed,
        updated_count,
        error_count,
        details
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
      status: {
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
      },

      fx:
        null,
    }
  }

  let fx:
    | MarketFx
    | null =
      null

  if (
    data.details &&
    typeof data.details ===
      'object' &&
    !Array.isArray(
      data.details
    )
  ) {
    const details =
      data.details as Record<
        string,
        unknown
      >

    fx =
      normalizeFx(
        details.fx
      )
  }

  return {
    status: {
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
    },

    fx,
  }
}

export async function getPriceUpdateStatus():
  Promise<PriceUpdateStatus> {
  const state =
    await getMarketSyncState()

  return state.status
}

export async function getStoredMarketFx():
  Promise<MarketFx | null> {
  const state =
    await getMarketSyncState()

  return state.fx
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

  const {
    error,
  } =
    await supabase
      .from(
        'app_sync_status'
      )
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

  if (
    result.updatedCount > 0
  ) {
    const snapshot =
      await saveTodaySnapshot()

    result.snapshot =
      snapshot
  }

  if (
    result.updatedCount > 0
  ) {
    await savePriceUpdateStatus(
      result
    )
  }

  return result
}