import { supabase } from '../lib/supabase'

export type ValuationMode =
  | 'unit_price'
  | 'total_value'

export type ManualInstrument = {
  id: string
  name: string
  ticker: string | null
  currency: string | null
  valuation_mode: ValuationMode
}

export type ImportedPrice = {
  price_date: string
  close_price: number
}

export type ManualValuationOverview = {
  id: string
  name: string
  ticker: string | null
  currency: string | null
  valuationMode: ValuationMode

  quantity: number
  currentValue: number

  latestPrice: number | null
  latestDate: string | null
  priceSource: string | null
}

export async function getManualInstruments() {
  const { data, error } = await supabase
    .from('instruments')
    .select(`
      id,
      name,
      ticker,
      currency,
      valuation_mode
    `)
    .eq(
      'pricing_source',
      'manual'
    )
    .order('name')

  if (error) {
    throw error
  }

  return (data ?? []).map(
    (instrument) => ({
      id:
        instrument.id,

      name:
        instrument.name,

      ticker:
        instrument.ticker,

      currency:
        instrument.currency,

      valuation_mode:
        instrument.valuation_mode ===
        'total_value'
          ? 'total_value'
          : 'unit_price',
    })
  ) as ManualInstrument[]
}

export async function getManualValuationOverview() {
  const {
    data: instruments,
    error,
  } = await supabase
    .from('instruments')
    .select(`
      id,
      name,
      ticker,
      currency,
      valuation_mode,
      positions (
        quantity,
        current_value
      )
    `)
    .eq(
      'pricing_source',
      'manual'
    )
    .order('name')

  if (error) {
    throw error
  }

  const result:
    ManualValuationOverview[] = []

  for (
    const instrument of
    instruments ?? []
  ) {
    const {
      data: prices,
      error: priceError,
    } = await supabase
      .from('price_history')
      .select(`
        price_date,
        close_price,
        source
      `)
      .eq(
        'instrument_id',
        instrument.id
      )
      .order(
        'price_date',
        {
          ascending: false,
        }
      )
      .limit(1)

    if (priceError) {
      throw priceError
    }

    const latestPrice =
      prices?.[0] ??
      null

    const positions =
      instrument.positions ??
      []

    const quantity =
      positions.reduce(
        (sum, position) =>
          sum +
          Number(
            position.quantity ??
              0
          ),
        0
      )

    const currentValue =
      positions.reduce(
        (sum, position) =>
          sum +
          Number(
            position.current_value ??
              0
          ),
        0
      )

    result.push({
      id:
        instrument.id,

      name:
        instrument.name,

      ticker:
        instrument.ticker,

      currency:
        instrument.currency,

      valuationMode:
        instrument.valuation_mode ===
        'total_value'
          ? 'total_value'
          : 'unit_price',

      quantity,

      currentValue,

      latestPrice:
        latestPrice
          ? Number(
              latestPrice.close_price
            )
          : null,

      latestDate:
        latestPrice
          ?.price_date ??
        null,

      priceSource:
        latestPrice
          ?.source ??
        null,
    })
  }

  return result
}

export async function saveManualUnitPrice(
  instrumentId: string,
  date: string,
  price: number
) {
  if (
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error(
      'Cena musí být větší než nula.'
    )
  }

  const {
    error: priceError,
  } = await supabase
    .from('price_history')
    .upsert(
      {
        instrument_id:
          instrumentId,

        price_date:
          date,

        close_price:
          price,

        source:
          'MANUAL',
      },
      {
        onConflict:
          'instrument_id,price_date',
      }
    )

  if (priceError) {
    throw priceError
  }

  const {
    data: positions,
    error: positionsError,
  } = await supabase
    .from('positions')
    .select(`
      id,
      quantity
    `)
    .eq(
      'instrument_id',
      instrumentId
    )

  if (positionsError) {
    throw positionsError
  }

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

    const currentValue =
      quantity * price

    const {
      error: updateError,
    } = await supabase
      .from('positions')
      .update({
        current_value:
          currentValue,
      })
      .eq(
        'id',
        position.id
      )

    if (updateError) {
      throw updateError
    }
  }
}

export async function saveManualTotalValue(
  instrumentId: string,
  totalValue: number
) {
  if (
    !Number.isFinite(
      totalValue
    ) ||
    totalValue < 0
  ) {
    throw new Error(
      'Hodnota nesmí být záporná.'
    )
  }

  const {
    data: positions,
    error,
  } = await supabase
    .from('positions')
    .select('id')
    .eq(
      'instrument_id',
      instrumentId
    )

  if (error) {
    throw error
  }

  if (
    !positions ||
    positions.length === 0
  ) {
    throw new Error(
      'Instrument nemá žádnou pozici.'
    )
  }

  if (
    positions.length > 1
  ) {
    throw new Error(
      'Instrument má více pozic. Celkovou hodnotu nelze jednoznačně přiřadit.'
    )
  }

  const {
    error: updateError,
  } = await supabase
    .from('positions')
    .update({
      current_value:
        totalValue,
    })
    .eq(
      'id',
      positions[0].id
    )

  if (updateError) {
    throw updateError
  }
}

export async function importManualPrices(
  instrumentId: string,
  rows: ImportedPrice[]
) {
  if (
    rows.length === 0
  ) {
    throw new Error(
      'CSV neobsahuje žádné platné ceny.'
    )
  }

  const databaseRows =
    rows.map(
      (row) => ({
        instrument_id:
          instrumentId,

        price_date:
          row.price_date,

        close_price:
          row.close_price,

        source:
          'MANUAL_IMPORT',
      })
    )

  const batchSize = 500

  for (
    let start = 0;
    start <
    databaseRows.length;
    start += batchSize
  ) {
    const batch =
      databaseRows.slice(
        start,
        start + batchSize
      )

    const {
      error,
    } = await supabase
      .from('price_history')
      .upsert(
        batch,
        {
          onConflict:
            'instrument_id,price_date',
        }
      )

    if (error) {
      throw error
    }
  }

  const latest =
    [...rows].sort(
      (a, b) =>
        b.price_date.localeCompare(
          a.price_date
        )
    )[0]

  await saveManualUnitPrice(
    instrumentId,
    latest.price_date,
    latest.close_price
  )

  return {
    importedCount:
      rows.length,

    latestDate:
      latest.price_date,

    latestPrice:
      latest.close_price,
  }
}