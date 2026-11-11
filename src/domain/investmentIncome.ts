export type InvestmentIncomeEntryType = 'DIVIDEND' | 'COUPON' | 'INTEREST'

export type InvestmentIncomeInput = {
  instrumentId: string
  transactionDate: string
  transactionType: InvestmentIncomeEntryType
  amountCzk: number
  currency: string
  fxRate: number
  note: string
}

export function validateInvestmentIncome(input: InvestmentIncomeInput) {
  const errors: string[] = []

  if (!input.instrumentId) errors.push('Vyberte instrument.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) errors.push('Zadejte platné datum.')
  if (!['DIVIDEND', 'COUPON', 'INTEREST'].includes(input.transactionType)) errors.push('Neplatný typ investičního příjmu.')
  if (!Number.isFinite(input.amountCzk) || input.amountCzk <= 0) errors.push('Částka musí být větší než nula.')
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.push('Měna musí být třípísmenný kód.')
  if (!Number.isFinite(input.fxRate) || input.fxRate <= 0) errors.push('FX kurz musí být větší než nula.')

  return {
    valid: errors.length === 0,
    errors,
  }
}
