export type ExternalCashflowType = 'DEPOSIT' | 'WITHDRAWAL'

export type ExternalCashflowInput = {
  transactionDate: string
  transactionType: ExternalCashflowType
  amountCzk: number
  note: string
}

export type ExternalCashflowValidation = {
  valid: boolean
  errors: string[]
  storedAmountCzk: number
}

export function getStoredExternalCashflowAmount(
  transactionType: ExternalCashflowType,
  amountCzk: number,
) {
  const absoluteAmount = Math.abs(amountCzk)
  return transactionType === 'DEPOSIT'
    ? absoluteAmount
    : -absoluteAmount
}

export function validateExternalCashflow(
  input: ExternalCashflowInput,
): ExternalCashflowValidation {
  const errors: string[] = []

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) {
    errors.push('Zadejte platné datum.')
  }

  if (!Number.isFinite(input.amountCzk) || input.amountCzk <= 0) {
    errors.push('Částka musí být větší než nula.')
  }

  return {
    valid: errors.length === 0,
    errors,
    storedAmountCzk: getStoredExternalCashflowAmount(
      input.transactionType,
      input.amountCzk,
    ),
  }
}
