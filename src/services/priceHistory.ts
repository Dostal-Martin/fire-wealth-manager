import { supabase } from '../lib/supabase'

export type PriceInstrument = {
  id: string
  name: string
  ticker: string
  currency: string | null

  pricingSource:
    | 'yahoo'
    | 'manual'

  valuationMode:
    | 'unit_price'
    | 'total_value'
}

export type PriceHistoryRow = {
  id: number

  instrument_id: string

  price_date: string

  close_price: number

  source:
    | string
    | null
}

type InstrumentRow = {
  id: string
  name: string
  ticker: string | null
  currency: string | null

  pricing_source:
    | string
    | null

  valuation_mode:
    | string
    | null
}

export async function getPriceInstruments() {
  /*
   * Načteme:
   *
   * 1. Yahoo instrumenty
   * 2. Ruční instrumenty s cenou za jednotku
   *
   * Nezahrnujeme total_value,
   * protože nemají skutečnou jednotkovou
   * cenovou historii.
   */

  const { data, error } = await supabase
    .from('instruments')
    .select(`
      id,
      name,
      ticker,
      currency,
      pricing_source,
      valuation_mode
    `)
    .or(
      [
        'pricing_source.eq.yahoo',
        'and(pricing_source.eq.manual,valuation_mode.eq.unit_price)',
      ].join(',')
    )
    .order('name')

  if (error) {
    throw error
  }

  const instruments =
    (
      data ??
      []
    ) as InstrumentRow[]

  /*
   * U manuálních instrumentů ještě ověříme,
   * že opravdu mají alespoň jeden záznam
   * v price_history.
   *
   * Jinak by se v selectu zobrazoval fond,
   * který zatím nikdy nebyl oceněný.
   */

  const result:
    PriceInstrument[] = []

  for (
    const instrument of
    instruments
  ) {
    const pricingSource =
      instrument.pricing_source ===
      'yahoo'
        ? 'yahoo'
        : 'manual'

    const valuationMode =
      instrument.valuation_mode ===
      'total_value'
        ? 'total_value'
        : 'unit_price'

    if (
      pricingSource ===
      'manual'
    ) {
      const {
        data: latestPrice,
        error: priceError,
      } = await supabase
        .from('price_history')
        .select('id')
        .eq(
          'instrument_id',
          instrument.id
        )
        .limit(1)

      if (priceError) {
        throw priceError
      }

      if (
        !latestPrice ||
        latestPrice.length === 0
      ) {
        continue
      }
    }

    result.push({
      id:
        instrument.id,

      name:
        instrument.name,

      ticker:
        instrument.ticker ??
        instrument.name,

      currency:
        instrument.currency,

      pricingSource,

      valuationMode,
    })
  }

  /*
   * Řazení:
   *
   * Yahoo nejdříve podle tickeru,
   * poté ruční fondy podle názvu.
   */

  result.sort(
    (a, b) => {
      if (
        a.pricingSource !==
        b.pricingSource
      ) {
        return a.pricingSource ===
          'yahoo'
          ? -1
          : 1
      }

      return a.name.localeCompare(
        b.name,
        'cs'
      )
    }
  )

  return result
}

export async function getInstrumentPriceHistory(
  instrumentId: string
) {
  /*
   * Supabase má standardně omezený počet
   * řádků jednoho requestu.
   *
   * Proto historii načítáme po stránkách.
   */

  const pageSize =
    1000

  let from =
    0

  const allRows:
    PriceHistoryRow[] = []

  while (true) {
    const { data, error } =
      await supabase
        .from(
          'price_history'
        )
        .select(`
          id,
          instrument_id,
          price_date,
          close_price,
          source
        `)
        .eq(
          'instrument_id',
          instrumentId
        )
        .order(
          'price_date',
          {
            ascending:
              true,
          }
        )
        .range(
          from,
          from +
            pageSize -
            1
        )

    if (error) {
      throw error
    }

    const page =
      (
        data ??
        []
      ).map(
        (row) => ({
          id:
            Number(
              row.id
            ),

          instrument_id:
            row.instrument_id,

          price_date:
            row.price_date,

          close_price:
            Number(
              row.close_price
            ),

          source:
            row.source,
        })
      ) as PriceHistoryRow[]

    allRows.push(
      ...page
    )

    if (
      page.length <
      pageSize
    ) {
      break
    }

    from +=
      pageSize
  }

  /*
   * Ochrana proti případným
   * nevalidním cenám.
   */

  return allRows.filter(
    (row) =>
      Number.isFinite(
        row.close_price
      ) &&
      row.close_price >
        0
  )
}