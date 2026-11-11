export type ManualTransactionType = 'BUY' | 'SELL'

export type ManualTransactionInput = {
  instrumentId: string
  transactionDate: string
  transactionType: ManualTransactionType
  quantity: number
  unitPrice: number
  currency: string
  fxRate: number
  feesCzk: number
  taxCzk: number
  note: string
}

export type ManualTransactionValidation = {
  valid: boolean
  errors: string[]
  grossAmountCzk: number
  amountCzk: number
}

export function calculateManualTransactionAmount(input: ManualTransactionInput) {
  const grossAmountCzk = input.quantity * input.unitPrice * input.fxRate
  const amountCzk = input.transactionType === 'BUY'
    ? grossAmountCzk + input.feesCzk + input.taxCzk
    : grossAmountCzk - input.feesCzk - input.taxCzk

  return { grossAmountCzk, amountCzk }
}

export function validateManualTransaction(
  input: ManualTransactionInput,
  availableQuantity: number | null,
): ManualTransactionValidation {
  const errors: string[] = []
  const { grossAmountCzk, amountCzk } = calculateManualTransactionAmount(input)

  if (!input.instrumentId) errors.push('Vyberte instrument.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) errors.push('Zadejte platné datum.')
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) errors.push('Množství musí být větší než nula.')
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) errors.push('Cena za jednotku nesmí být záporná.')
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.push('Měna musí být třípísmenný kód, například CZK nebo USD.')
  if (!Number.isFinite(input.fxRate) || input.fxRate <= 0) errors.push('FX kurz musí být větší než nula.')
  if (!Number.isFinite(input.feesCzk) || input.feesCzk < 0) errors.push('Poplatek nesmí být záporný.')
  if (!Number.isFinite(input.taxCzk) || input.taxCzk < 0) errors.push('Daň nesmí být záporná.')
  if (!Number.isFinite(amountCzk) || amountCzk <= 0) errors.push('Celková částka musí být větší než nula.')

  if (
    input.transactionType === 'SELL'
    && availableQuantity !== null
    && Number.isFinite(input.quantity)
    && input.quantity > availableQuantity + 0.000000001
  ) {
    errors.push(`Nelze prodat ${input.quantity} jednotek. Z transakcí je dostupné množství ${availableQuantity}.`)
  }

  return { valid: errors.length === 0, errors, grossAmountCzk, amountCzk }
}
