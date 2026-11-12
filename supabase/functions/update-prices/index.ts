import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type RequestMode = "daily" | "backfill"

type RequestBody = {
  mode?: RequestMode
  ticker?: string
  tickers?: string[]
  startDate?: string
  overlapDays?: number
  updatePositions?: boolean
  backfillFx?: boolean
}

type Instrument = {
  id: string
  name: string
  ticker: string
  currency: string | null
  pricing_source: string
}

type PriceRow = {
  instrument_id: string
  price_date: string
  close_price: number
  source: string
}

type FxRates = {
  CZK: number
  USD: number
  EUR: number
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  })
}

function localDateString(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function daysAgo(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return localDateString(date)
}

function toUnixTimestamp(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000)
}

function period2Unix() {
  return Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000)
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return Number.isFinite(new Date(`${value}T00:00:00Z`).getTime())
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchYahooChart(ticker: string, startDate: string) {
  const encodedTicker = encodeURIComponent(ticker)
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodedTicker}` +
    `?period1=${toUnixTimestamp(startDate)}` +
    `&period2=${period2Unix()}` +
    `&interval=1d` +
    `&events=history` +
    `&includeAdjustedClose=true`

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`${ticker}: Yahoo HTTP ${response.status}`)
  }

  const yahooData = await response.json()
  const yahooError = yahooData?.chart?.error?.description
  if (yahooError) throw new Error(`${ticker}: ${yahooError}`)

  const result = yahooData?.chart?.result?.[0]
  if (!result) throw new Error(`${ticker}: Yahoo nevrátil historii`)

  const timestamps: number[] = result.timestamp ?? []
  const closes: Array<number | null> = result.indicators?.quote?.[0]?.close ?? []

  return {
    currency: String(result.meta?.currency ?? "").toUpperCase() || null,
    timestamps,
    closes,
  }
}

function chartToRows(
  instrument: Instrument,
  chart: Awaited<ReturnType<typeof fetchYahooChart>>,
  source: string,
) {
  const rows: PriceRow[] = []

  for (let index = 0; index < chart.timestamps.length; index += 1) {
    const timestamp = chart.timestamps[index]
    const close = Number(chart.closes[index])

    if (!timestamp || !Number.isFinite(close) || close <= 0) continue

    rows.push({
      instrument_id: instrument.id,
      price_date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close_price: close,
      source,
    })
  }

  return rows
}

async function upsertInBatches(
  supabase: ReturnType<typeof createClient>,
  rows: PriceRow[],
  batchSize = 500,
) {
  let processed = 0

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    const { error } = await supabase
      .from("price_history")
      .upsert(batch, { onConflict: "instrument_id,price_date" })

    if (error) throw error
    processed += batch.length
  }

  return processed
}

async function fetchFxQuote(ticker: "USDCZK=X" | "EURCZK=X") {
  const chart = await fetchYahooChart(ticker, daysAgo(10))

  for (let index = chart.timestamps.length - 1; index >= 0; index -= 1) {
    const rate = Number(chart.closes[index])
    const timestamp = chart.timestamps[index]
    if (timestamp && Number.isFinite(rate) && rate > 0) {
      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        rate,
      }
    }
  }

  throw new Error(`${ticker}: chybí platný FX kurz`)
}

async function backfillFxHistory(
  supabase: ReturnType<typeof createClient>,
  startDate: string,
) {
  const pairs = [
    { ticker: "USDCZK=X" as const, pair: "USDCZK" },
    { ticker: "EURCZK=X" as const, pair: "EURCZK" },
  ]

  const results = []

  for (const item of pairs) {
    const chart = await fetchYahooChart(item.ticker, startDate)
    const rows = []

    for (let index = 0; index < chart.timestamps.length; index += 1) {
      const timestamp = chart.timestamps[index]
      const rate = Number(chart.closes[index])
      if (!timestamp || !Number.isFinite(rate) || rate <= 0) continue

      rows.push({
        currency_pair: item.pair,
        fx_date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        fx_rate: rate,
      })
    }

    let upsertedCount = 0
    for (let start = 0; start < rows.length; start += 500) {
      const batch = rows.slice(start, start + 500)
      const { error } = await supabase
        .from("fx_history")
        .upsert(batch, { onConflict: "currency_pair,fx_date" })

      if (error) throw error
      upsertedCount += batch.length
    }

    results.push({
      currencyPair: item.pair,
      firstDate: rows[0]?.fx_date ?? null,
      lastDate: rows[rows.length - 1]?.fx_date ?? null,
      observationCount: rows.length,
      upsertedCount,
    })

    await sleep(250)
  }

  return results
}

async function updateFx(supabase: ReturnType<typeof createClient>) {
  const [usd, eur] = await Promise.all([
    fetchFxQuote("USDCZK=X"),
    fetchFxQuote("EURCZK=X"),
  ])

  const { error } = await supabase.from("fx_history").upsert([
    { currency_pair: "USDCZK", fx_date: usd.date, fx_rate: usd.rate },
    { currency_pair: "EURCZK", fx_date: eur.date, fx_rate: eur.rate },
  ], { onConflict: "currency_pair,fx_date" })

  if (error) throw error

  return {
    date: usd.date > eur.date ? usd.date : eur.date,
    USDCZK: usd.rate,
    EURCZK: eur.rate,
  }
}

async function updateInstrumentPositions(
  supabase: ReturnType<typeof createClient>,
  instrument: Instrument,
  latestPrice: number,
  fxRates: FxRates,
) {
  const currency = (instrument.currency ?? "CZK").toUpperCase()
  const fxRate = fxRates[currency as keyof FxRates]
  if (!fxRate) throw new Error(`${instrument.ticker}: nepodporovaná měna ${currency}`)

  const { data: positions, error: positionsError } = await supabase
    .from("positions")
    .select("id,quantity")
    .eq("instrument_id", instrument.id)

  if (positionsError) throw positionsError

  const updates = []
  for (const position of positions ?? []) {
    const quantity = Number(position.quantity)
    if (!Number.isFinite(quantity)) continue

    const currentValue = quantity * latestPrice * fxRate
    if (!Number.isFinite(currentValue) || currentValue < 0) continue

    const { error } = await supabase
      .from("positions")
      .update({ current_value: currentValue, valuation_date: localDateString() })
      .eq("id", position.id)

    if (error) throw error
    updates.push({ positionId: position.id, quantity, currentValue })
  }

  return updates
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Použijte POST request" }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Chybí Supabase environment variables")
    }

    let body: RequestBody = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const mode: RequestMode = body.mode === "backfill" ? "backfill" : "daily"
    const overlapDays = Math.min(Math.max(Number(body.overlapDays ?? 10), 2), 31)
    const startDate = mode === "backfill"
      ? body.startDate ?? "2021-01-01"
      : daysAgo(overlapDays)

    if (!isValidDateString(startDate)) {
      return jsonResponse({ ok: false, error: "startDate musí mít formát YYYY-MM-DD" }, 400)
    }

    if (toUnixTimestamp(startDate) >= period2Unix()) {
      return jsonResponse({ ok: false, error: "startDate musí být v minulosti" }, 400)
    }

    const requestedTickers = [
      ...(body.ticker ? [body.ticker] : []),
      ...(Array.isArray(body.tickers) ? body.tickers : []),
    ].map((ticker) => ticker.trim()).filter(Boolean)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    let fxBackfill = null
    if (mode === "backfill" && body.backfillFx === true) {
      fxBackfill = await backfillFxHistory(supabase, startDate)
    }

    let query = supabase
      .from("instruments")
      .select("id,name,ticker,currency,pricing_source")
      .eq("pricing_source", "yahoo")
      .not("ticker", "is", null)
      .order("ticker")

    if (requestedTickers.length === 1) {
      query = query.eq("ticker", requestedTickers[0])
    } else if (requestedTickers.length > 1) {
      query = query.in("ticker", requestedTickers)
    }

    const { data, error: instrumentsError } = await query
    if (instrumentsError) throw instrumentsError

    const instruments = (data ?? []).filter(
      (item): item is Instrument => typeof item.ticker === "string" && item.ticker.trim() !== "",
    )

    if (instruments.length === 0) {
      return jsonResponse({
        ok: false,
        mode,
        processed: 0,
        updatedCount: 0,
        errorCount: 0,
        error: requestedTickers.length
          ? `Ticker ${requestedTickers.join(", ")} nebyl nalezen`
          : "Nebyly nalezeny Yahoo instrumenty",
      })
    }

    let fx: { date: string; USDCZK: number; EURCZK: number } | null = null
    if (mode === "daily" || body.updatePositions === true) {
      fx = await updateFx(supabase)
    }

    const updated = []
    const errors = []
    let upsertedCount = 0

    for (const instrument of instruments) {
      try {
        const chart = await fetchYahooChart(instrument.ticker, startDate)
        const rows = chartToRows(
          instrument,
          chart,
          mode === "backfill" ? "YAHOO_BACKFILL" : "YAHOO",
        )

        if (rows.length === 0) {
          throw new Error(`${instrument.ticker}: žádné platné zavírací ceny`)
        }

        const upserted = await upsertInBatches(supabase, rows)
        upsertedCount += upserted

        const latest = rows[rows.length - 1]
        let positions: unknown[] = []

        if ((mode === "daily" || body.updatePositions === true) && fx) {
          positions = await updateInstrumentPositions(
            supabase,
            instrument,
            latest.close_price,
            { CZK: 1, USD: fx.USDCZK, EUR: fx.EURCZK },
          )
        }

        updated.push({
          name: instrument.name,
          ticker: instrument.ticker,
          mode,
          startDate,
          firstDate: rows[0].price_date,
          lastDate: latest.price_date,
          priceCount: rows.length,
          upsertedCount: upserted,
          positions,
        })
      } catch (error) {
        console.error(instrument.ticker, error)
        errors.push({
          name: instrument.name,
          ticker: instrument.ticker,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      await sleep(250)
    }

    let snapshot = null
    if ((mode === "daily" || body.updatePositions === true) && updated.length > 0) {
      const { data, error } = await supabase.rpc("fire_wm_upsert_today_snapshot", {
        p_portfolio_id: "29cc8d4e-7548-45d0-9a11-ae4d53b55d62",
      })
      if (error) throw error
      snapshot = {
        date: localDateString(),
        netWorth: Number(data),
      }
    }

    return jsonResponse({
      ok: errors.length === 0,
      mode,
      startDate,
      overlapDays: mode === "daily" ? overlapDays : null,
      fx,
      fxBackfill,
      processed: instruments.length,
      updatedCount: updated.length,
      upsertedCount,
      errorCount: errors.length,
      snapshot,
      updated,
      errors,
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500)
  }
})
