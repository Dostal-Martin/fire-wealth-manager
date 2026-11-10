import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
}

type RequestBody = {
  ticker?: string
  startDate?: string
}

type Instrument = {
  id: string
  name: string
  ticker: string
  pricing_source: string
}

type PriceRow = {
  instrument_id: string
  price_date: string
  close_price: number
  source: string
}

function jsonResponse(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    }
  )
}

function toUnixTimestamp(
  date: string
) {
  return Math.floor(
    new Date(
      `${date}T00:00:00Z`
    ).getTime() / 1000
  )
}

function todayPlusOneDayUnix() {
  return Math.floor(
    (
      Date.now() +
      24 * 60 * 60 * 1000
    ) / 1000
  )
}

function isValidDateString(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  )
}

function sleep(
  milliseconds: number
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  )
}

async function fetchYahooHistory(
  instrument: Instrument,
  startDate: string
) {
  const period1 =
    toUnixTimestamp(startDate)

  const period2 =
    todayPlusOneDayUnix()

  const ticker =
    encodeURIComponent(
      instrument.ticker
    )

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}` +
    `?period1=${period1}` +
    `&period2=${period2}` +
    `&interval=1d` +
    `&events=history` +
    `&includeAdjustedClose=true`

  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0",

          "Accept":
            "application/json",
        },
      }
    )

  if (!response.ok) {
    throw new Error(
      `${instrument.ticker}: Yahoo HTTP ${response.status}`
    )
  }

  const yahooData =
    await response.json()

  const yahooError =
    yahooData?.chart
      ?.error?.description

  if (yahooError) {
    throw new Error(
      `${instrument.ticker}: ${yahooError}`
    )
  }

  const result =
    yahooData?.chart
      ?.result?.[0]

  if (!result) {
    throw new Error(
      `${instrument.ticker}: Yahoo nevrátil historii`
    )
  }

  const timestamps:
    number[] =
      result.timestamp ?? []

  const closes:
    Array<number | null> =
      result.indicators
        ?.quote?.[0]
        ?.close ?? []

  const rows: PriceRow[] = []

  for (
    let index = 0;
    index < timestamps.length;
    index++
  ) {
    const timestamp =
      timestamps[index]

    const close =
      Number(
        closes[index]
      )

    if (
      !timestamp ||
      !Number.isFinite(close) ||
      close <= 0
    ) {
      continue
    }

    const priceDate =
      new Date(
        timestamp * 1000
      )
        .toISOString()
        .slice(0, 10)

    rows.push({
      instrument_id:
        instrument.id,

      price_date:
        priceDate,

      close_price:
        close,

      source:
        "YAHOO_BACKFILL",
    })
  }

  return rows
}

async function upsertInBatches(
  supabase: any,
  rows: PriceRow[],
  batchSize = 500
) {
  let inserted = 0

  for (
    let start = 0;
    start < rows.length;
    start += batchSize
  ) {
    const batch =
      rows.slice(
        start,
        start + batchSize
      )

    const {
      error
    } = await supabase
      .from("price_history")
      .upsert(
        batch,
        {
          onConflict:
            "instrument_id,price_date",
        }
      )

    if (error) {
      throw error
    }

    inserted +=
      batch.length
  }

  return inserted
}

Deno.serve(
  async (request) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        }
      )
    }

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Použijte POST request",
        },
        405
      )
    }

    try {
      const supabaseUrl =
        Deno.env.get(
          "SUPABASE_URL"
        )

      const serviceRoleKey =
        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY"
        )

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        throw new Error(
          "Chybí Supabase environment variables"
        )
      }

      let body:
        RequestBody = {}

      try {
        body =
          await request.json()
      } catch {
        body = {}
      }

      const startDate =
        body.startDate ??
        "2021-01-01"

      if (
        !isValidDateString(
          startDate
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "startDate musí mít formát YYYY-MM-DD",
          },
          400
        )
      }

      const supabase =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              persistSession:
                false,

              autoRefreshToken:
                false,
            },
          }
        )

      let query =
        supabase
          .from("instruments")
          .select(
            "id,name,ticker,pricing_source"
          )
          .eq(
            "pricing_source",
            "yahoo"
          )
          .not(
            "ticker",
            "is",
            null
          )
          .order(
            "ticker"
          )

      if (body.ticker) {
        query =
          query.eq(
            "ticker",
            body.ticker
          )
      }

      const {
        data,
        error:
          instrumentsError,
      } = await query

      if (instrumentsError) {
        throw instrumentsError
      }

      const instruments =
        (
          data ?? []
        ).filter(
          (
            item
          ): item is Instrument =>
            typeof item.ticker ===
              "string" &&
            item.ticker.trim() !==
              ""
        )

      if (
        instruments.length === 0
      ) {
        return jsonResponse({
          ok: false,
          processed: 0,
          insertedCount: 0,
          errorCount: 0,
          error:
            body.ticker
              ? `Ticker ${body.ticker} nebyl nalezen`
              : "Nebyly nalezeny Yahoo instrumenty",
        })
      }

      const updated = []

      const errors = []

      let insertedCount = 0

      for (
        const instrument of
        instruments
      ) {
        try {
          const rows =
            await fetchYahooHistory(
              instrument,
              startDate
            )

          const inserted =
            await upsertInBatches(
              supabase,
              rows
            )

          insertedCount +=
            inserted

          updated.push({
            name:
              instrument.name,

            ticker:
              instrument.ticker,

            startDate,

            firstDate:
              rows[0]
                ?.price_date ??
              null,

            lastDate:
              rows[
                rows.length - 1
              ]?.price_date ??
              null,

            priceCount:
              rows.length,

            insertedCount:
              inserted,
          })
        } catch (error) {
          console.error(
            instrument.ticker,
            error
          )

          errors.push({
            name:
              instrument.name,

            ticker:
              instrument.ticker,

            error:
              error instanceof Error
                ? error.message
                : String(error),
          })
        }

        /*
         * Malá prodleva kvůli
         * omezení Yahoo requestů.
         */
        await sleep(200)
      }

      return jsonResponse({
        ok:
          errors.length === 0,

        startDate,

        processed:
          instruments.length,

        updatedCount:
          updated.length,

        insertedCount,

        errorCount:
          errors.length,

        updated,

        errors,
      })
    } catch (error) {
      console.error(error)

      return jsonResponse(
        {
          ok: false,

          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        500
      )
    }
  }
)