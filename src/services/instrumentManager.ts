import { supabase } from '../lib/supabase'

export type PricingSource =
  | 'yahoo'
  | 'manual'

export type ValuationMode =
  | 'unit_price'
  | 'total_value'

export async function getInstruments() {
  const { data, error } = await supabase
    .from('instruments')
    .select('*')
    .order('name')

  if (error) {
    throw error
  }

  return data ?? []
}

export async function createInstrument(
  name: string,
  ticker: string,
  assetType: string,
  currency: string,
  pricingSource: PricingSource,
  valuationMode: ValuationMode
) {
  const normalizedTicker =
    ticker.trim() === ''
      ? null
      : ticker
          .trim()
          .toUpperCase()

  const { error } = await supabase
    .from('instruments')
    .insert({
      name:
        name.trim(),

      ticker:
        normalizedTicker,

      asset_type:
        assetType.trim(),

      currency:
        currency.toUpperCase(),

      pricing_source:
        normalizedTicker
          ? pricingSource
          : 'manual',

      valuation_mode:
        valuationMode,
    })

  if (error) {
    throw error
  }
}

export async function updateInstrument(
  id: string,
  name: string,
  ticker: string,
  assetType: string,
  currency: string,
  pricingSource: PricingSource,
  valuationMode: ValuationMode
) {
  const normalizedTicker =
    ticker.trim() === ''
      ? null
      : ticker
          .trim()
          .toUpperCase()

  const { error } = await supabase
    .from('instruments')
    .update({
      name:
        name.trim(),

      ticker:
        normalizedTicker,

      asset_type:
        assetType.trim(),

      currency:
        currency.toUpperCase(),

      pricing_source:
        normalizedTicker
          ? pricingSource
          : 'manual',

      valuation_mode:
        valuationMode,
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function deleteInstrument(
  id: string
) {
  const { error } = await supabase
    .from('instruments')
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}
