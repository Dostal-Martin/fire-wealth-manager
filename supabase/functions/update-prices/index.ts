import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors"

type FxRates = {
  CZK: number
  USD: number
  EUR: number
}

async function getYahooQuote(ticker: string) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json"
    }
  })

  if (!response.ok) {
    throw new Error(
      `${ticker}: Yahoo HTTP ${response.status}`
    )
  }

  const data = await response.json()

  const result =
    data?.chart?.result?.[0]

  if (!result) {
    throw new Error(
      `${ticker}: Yahoo nevrátil data`
    )
  }

  const price =
    Number(
      result.meta?.regularMarketPrice
    )

  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error(
      `${ticker}: neplatná cena`
    )
  }

  const timestamp =
    result.meta?.regularMarketTime

  const date =
    timestamp
      ? new Date(timestamp * 1000)
          .toISOString()
          .slice(0, 10)
      : new Date()
          .toISOString()
          .slice(0, 10)

  return {
    price,
    currency:
      result.meta?.currency ?? null,
    date
  }
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
          "application/json"
      }
    }
  )
}

Deno.serve(async (request) => {
  // CORS PRE-FLIGHT
  // Důležité:
  // při OPTIONS se NESMÍ stahovat ceny
  // ani zapisovat do databáze.
  if (request.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders
      }
    )
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")

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

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey
      )

    // --------------------------------
    // 1. FX
    // --------------------------------

    const usdQuote =
      await getYahooQuote(
        "USDCZK=X"
      )

    const eurQuote =
      await getYahooQuote(
        "EURCZK=X"
      )

    const fxRates: FxRates = {
      CZK: 1,
      USD: usdQuote.price,
      EUR: eurQuote.price
    }

    const {
      error: fxError
    } = await supabase
      .from("fx_history")
      .upsert(
        [
          {
            currency_pair:
              "USDCZK",

            fx_date:
              usdQuote.date,

            fx_rate:
              usdQuote.price
          },

          {
            currency_pair:
              "EURCZK",

            fx_date:
              eurQuote.date,

            fx_rate:
              eurQuote.price
          }
        ],
        {
          onConflict:
            "currency_pair,fx_date"
        }
      )

    if (fxError) {
      throw fxError
    }

    // --------------------------------
    // 2. INSTRUMENTY
    // --------------------------------

    const {
      data: instruments,
      error: instrumentsError
    } = await supabase
      .from("instruments")
      .select(
        "id,name,ticker,currency,pricing_source"
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

    if (instrumentsError) {
      throw instrumentsError
    }

    const updated = []
    const errors = []

    // --------------------------------
    // 3. CENY + POZICE
    // --------------------------------

    for (
      const instrument of
      instruments ?? []
    ) {
      try {
        const ticker =
          instrument.ticker

        if (!ticker) {
          continue
        }

        const quote =
          await getYahooQuote(
            ticker
          )

        const currency =
          (
            quote.currency ??
            instrument.currency ??
            "CZK"
          ).toUpperCase()

        const fxRate =
          fxRates[
            currency as keyof FxRates
          ]

        if (!fxRate) {
          throw new Error(
            `${ticker}: nepodporovaná měna ${currency}`
          )
        }

        // ----------------------------
        // Price history
        // ----------------------------

        const {
          error: priceError
        } = await supabase
          .from("price_history")
          .upsert(
            {
              instrument_id:
                instrument.id,

              price_date:
                quote.date,

              close_price:
                quote.price,

              source:
                "YAHOO"
            },
            {
              onConflict:
                "instrument_id,price_date"
            }
          )

        if (priceError) {
          throw priceError
        }

        // ----------------------------
        // Pozice instrumentu
        // ----------------------------

        const {
          data: positions,
          error: positionsError
        } = await supabase
          .from("positions")
          .select(
            "id,quantity"
          )
          .eq(
            "instrument_id",
            instrument.id
          )

        if (positionsError) {
          throw positionsError
        }

        const positionUpdates = []

        for (
          const position of
          positions ?? []
        ) {
          const quantity =
            Number(
              position.quantity
            )

          if (
            !Number.isFinite(
              quantity
            )
          ) {
            continue
          }

          const currentValueCzk =
            quantity *
            quote.price *
            fxRate

          if (
            !Number.isFinite(
              currentValueCzk
            ) ||
            currentValueCzk < 0
          ) {
            continue
          }

          const {
            error: updateError
          } = await supabase
            .from("positions")
            .update({
              current_value:
                currentValueCzk
            })
            .eq(
              "id",
              position.id
            )

          if (updateError) {
            throw updateError
          }

          positionUpdates.push({
            positionId:
              position.id,

            quantity,

            currentValueCzk
          })
        }

        updated.push({
          name:
            instrument.name,

          ticker,

          price:
            quote.price,

          currency,

          fxRate,

          priceDate:
            quote.date,

          positions:
            positionUpdates
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
              : String(error)
        })
      }
    }

    return jsonResponse({
      ok:
        errors.length === 0,

      fx: {
        date:
          usdQuote.date,

        USDCZK:
          fxRates.USD,

        EURCZK:
          fxRates.EUR
      },

      processed:
        instruments?.length ?? 0,

      updatedCount:
        updated.length,

      errorCount:
        errors.length,

      updated,

      errors
    })
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : String(error)
      },
      500
    )
  }
})