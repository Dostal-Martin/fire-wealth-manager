import { supabase } from '../lib/supabase'

export type PortfolioInstrument = {
  id: string
  name: string
  ticker: string | null
  asset_type: string | null
  currency: string | null
}

export type PortfolioPosition = {
  id: string
  instrument_id: string

  quantity: number
  total_cost: number
  current_value: number

  instruments:
    PortfolioInstrument | null
}

type RawInstrument = {
  id: string
  name: string
  ticker: string | null
  asset_type: string | null
  currency: string | null
}

type RawPosition = {
  id: string
  instrument_id: string

  quantity:
    | number
    | string
    | null

  total_cost:
    | number
    | string
    | null

  current_value:
    | number
    | string
    | null

  instruments:
    | RawInstrument
    | RawInstrument[]
    | null
}

function normalizeInstrument(
  value:
    | RawInstrument
    | RawInstrument[]
    | null
): PortfolioInstrument | null {
  if (!value) {
    return null
  }

  const instrument =
    Array.isArray(value)
      ? value[0]
      : value

  if (!instrument) {
    return null
  }

  return {
    id:
      instrument.id,

    name:
      instrument.name,

    ticker:
      instrument.ticker ??
      null,

    asset_type:
      instrument.asset_type ??
      null,

    currency:
      instrument.currency ??
      null,
  }
}

export async function getPortfolioPositions():
  Promise<PortfolioPosition[]> {
  const {
    data,
    error,
  } = await supabase
    .from('positions')
    .select(`
      id,
      instrument_id,
      quantity,
      total_cost,
      current_value,
      instruments (
        id,
        name,
        ticker,
        asset_type,
        currency
      )
    `)

  if (error) {
    throw error
  }

  const rows =
    (
      data ??
      []
    ) as unknown as RawPosition[]

  return rows
    .map(
      (
        row
      ): PortfolioPosition => ({
        id:
          row.id,

        instrument_id:
          row.instrument_id,

        quantity:
          Number(
            row.quantity ??
            0
          ),

        total_cost:
          Number(
            row.total_cost ??
            0
          ),

        current_value:
          Number(
            row.current_value ??
            0
          ),

        instruments:
          normalizeInstrument(
            row.instruments
          ),
      })
    )
    .sort(
      (a, b) =>
        b.current_value -
        a.current_value
    )
}