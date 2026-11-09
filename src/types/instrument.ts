export interface Instrument {
  id: string
  name: string
  ticker: string | null
  asset_type: string
  currency: string
}