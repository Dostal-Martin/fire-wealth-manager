export type InvestmentIncomeEntryType = 'DIVIDEND' | 'COUPON' | 'INTEREST'

export type InvestmentIncomeInput = {
  instrumentId: string
  cashInstrumentId: string
  transactionDate: string
  transactionType: InvestmentIncomeEntryType
  amountNative: number
  currency: string
  fxRate: number
  taxNative: number
  feeNative: number
  note: string
}

export function validateInvestmentIncome(input: InvestmentIncomeInput) {
  const errors: string[] = []
  if (!input.instrumentId) errors.push('Vyberte zdrojový instrument.')
  if (!input.cashInstrumentId) errors.push('Vyberte cílový hotovostní účet.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) errors.push('Zadejte platné datum.')
  if (!['DIVIDEND', 'COUPON', 'INTEREST'].includes(input.transactionType)) errors.push('Neplatný typ investičního příjmu.')
  if (!Number.isFinite(input.amountNative) || input.amountNative <= 0) errors.push('Hrubá částka musí být větší než nula.')
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.push('Měna musí být třípísmenný kód.')
  if (!Number.isFinite(input.fxRate) || input.fxRate <= 0) errors.push('FX kurz musí být větší než nula.')
  if (!Number.isFinite(input.taxNative) || input.taxNative < 0) errors.push('Daň nesmí být záporná.')
  if (!Number.isFinite(input.feeNative) || input.feeNative < 0) errors.push('Poplatek nesmí být záporný.')
  if (input.amountNative - input.taxNative - input.feeNative <= 0) errors.push('Čistý příjem musí být větší než nula.')
  return { valid: errors.length === 0, errors }
}
