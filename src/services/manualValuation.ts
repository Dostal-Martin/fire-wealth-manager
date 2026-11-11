import { supabase } from '../lib/supabase'

export type ValuationMode =
  | 'unit_price'
  | 'total_value'

export type ValuationFreshness =
  | 'fresh'
  | 'warning'
  | 'stale'
  | 'missing'

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

  valuationAgeDays: number | null
  valuationFreshness: ValuationFreshness
  valuationFreshnessLabel: string | null
}

const DAY_MS =
  24 * 60 * 60 * 1000

function getLocalDateString(
  date = new Date()
) {
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

function parseDateAtUtcNoon(
  value: string
) {
  return new Date(
    `${value}T12:00:00Z`
  )
}

export function getValuationAgeDays(
  valuationDate: string | null,
  today = getLocalDateString()
): number | null {
  if (!valuationDate) {
    return null
  }

  const valuation =
    parseDateAtUtcNoon(
      valuationDate
    )

  const current =
    parseDateAtUtcNoon(
      today
    )

  if (
    Number.isNaN(
      valuation.getTime()
    ) ||
    Number.isNaN(
      current.getTime()
    )
  ) {
    return null
  }

  const difference =
    Math.floor(
      (
        current.getTime() -
        valuation.getTime()
      ) /
      DAY_MS
    )

  return Math.max(
    0,
    difference
  )
}

export function getValuationFreshness(
  valuationDate: string | null,
  today?: string
): {
  ageDays: number | null
  freshness: ValuationFreshness
  label: string | null
} {
  const ageDays =
    getValuationAgeDays(
      valuationDate,
      today
    )

  if (
    valuationDate === null ||
    ageDays === null
  ) {
    return {
      ageDays: null,
      freshness: 'missing',
      label:
        'Chybí datum ocenění',
    }
  }

  if (ageDays <= 35) {
    return {
      ageDays,
      freshness: 'fresh',
      label: null,
    }
  }

  if (ageDays <= 60) {
    return {
      ageDays,
      freshness: 'warning',
      label:
        'Starší ocenění',
    }
  }

  return {
    ageDays,
    freshness: 'stale',
    label:
      'Neaktuální ocenění',
  }
}

export async function getManualInstruments() {
  const {
    data,
    error,
  } =
    await supabase
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

  return (
    data ?? []
  ).map(
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
  } =
    await supabase
      .from('instruments')
      .select(`
        id,
        name,
        ticker,
        currency,
        valuation_mode,
        positions (
          quantity,
          current_value,
          valuation_date
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
    ManualValuationOverview[] =
      []

  for (
    const instrument of
    instruments ?? []
  ) {
    const {
      data: prices,
      error: priceError,
    } =
      await supabase
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

    const valuationMode:
      ValuationMode =
        instrument.valuation_mode ===
        'total_value'
          ? 'total_value'
          : 'unit_price'

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

    const positionDates =
      positions
        .map(
          (position) =>
            position.valuation_date
        )
        .filter(
          (
            date
          ): date is string =>
            Boolean(date)
        )
        .sort()

    const positionValuationDate =
      positionDates.length > 0
        ? positionDates[0]
        : null

    const latestDate =
      valuationMode ===
      'unit_price'
        ? latestPrice
            ?.price_date ??
          positionValuationDate
        : positionValuationDate

    const freshness =
      getValuationFreshness(
        latestDate
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

      valuationMode,

      quantity,

      currentValue,

      latestPrice:
        latestPrice
          ? Number(
              latestPrice.close_price
            )
          : null,

      latestDate,

      priceSource:
        latestPrice
          ?.source ??
        null,

      valuationAgeDays:
        freshness.ageDays,

      valuationFreshness:
        freshness.freshness,

      valuationFreshnessLabel:
        freshness.label,
    })
  }

  return result
}

export async function saveManualUnitPrice(
  instrumentId: string,
  date: string,
  price: number
) {
  if (!date) {
    throw new Error(
      'Datum ocenění je povinné.'
    )
  }

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
  } =
    await supabase
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
  } =
    await supabase
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
    } =
      await supabase
        .from('positions')
        .update({
          current_value:
            currentValue,

          valuation_date:
            date,
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
  totalValue: number,
  valuationDate =
    getLocalDateString()
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

  if (!valuationDate) {
    throw new Error(
      'Datum ocenění je povinné.'
    )
  }

  const {
    data: positions,
    error,
  } =
    await supabase
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
  } =
    await supabase
      .from('positions')
      .update({
        current_value:
          totalValue,

        valuation_date:
          valuationDate,
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
    } =
      await supabase
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