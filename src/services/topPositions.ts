import { supabase } from '../lib/supabase'

export type TopPosition = {
  id: string
  current_value: number

  instruments:
    | {
        name: string
        ticker: string | null
      }
    | null
}

type RawInstrument = {
  name: string
  ticker: string | null
}

type RawTopPosition = {
  id: string

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
) {
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
    name:
      instrument.name,

    ticker:
      instrument.ticker ??
      null,
  }
}

export async function getTopPositions():
  Promise<TopPosition[]> {
  const {
    data,
    error,
  } = await supabase
    .from('positions')
    .select(`
      id,
      current_value,
      instruments (
        name,
        ticker
      )
    `)

  if (error) {
    throw error
  }

  const rows =
    (
      data ??
      []
    ) as unknown as RawTopPosition[]

  return rows
    .map(
      (
        row
      ): TopPosition => ({
        id:
          row.id,

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
    .slice(
      0,
      5
    )
}