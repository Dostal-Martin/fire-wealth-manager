export async function loadPrices() {
  const tickers = [
    'CEZ.PR',
    'KOMB.PR',
    'ERBAG.PR',
    'NVDA',
    'BAC',
    'NKE',
    'MRK',
    'VWCE.DE',
    'SXRV.DE',
  ]

  return tickers.map((ticker) => ({
    ticker,
    status: 'Připraveno',
  }))
}