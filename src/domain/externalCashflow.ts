export type ExternalCashflowType = 'DEPOSIT' | 'WITHDRAWAL'
export type ExternalCashflowInput = {
  cashInstrumentId: string
  transactionDate: string
  transactionType: ExternalCashflowType
  amountNative: number
  currency: string
  fxRate: number
  note: string
}
export function validateExternalCashflow(input: ExternalCashflowInput) {
  const errors: string[] = []
  if (!input.cashInstrumentId) errors.push('Vyberte hotovostní účet.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) errors.push('Zadejte platné datum.')
  if (!['DEPOSIT','WITHDRAWAL'].includes(input.transactionType)) errors.push('Neplatný typ externího cashflow.')
  if (!Number.isFinite(input.amountNative) || input.amountNative <= 0) errors.push('Částka musí být větší než nula.')
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.push('Měna musí být třípísmenný kód.')
  if (!Number.isFinite(input.fxRate) || input.fxRate <= 0) errors.push('FX kurz musí být větší než nula.')
  return { valid: errors.length === 0, errors, amountCzk: input.amountNative * input.fxRate }
}
