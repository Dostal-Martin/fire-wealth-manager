export type ManualTransactionType = 'BUY' | 'SELL'

export type ManualTransactionInput = {
  instrumentId: string
  cashInstrumentId: string
  transactionDate: string
  transactionType: ManualTransactionType
  quantity: number
  unitPrice: number
  currency: string
  fxRate: number
  feesNative: number
  taxNative: number
  note: string
}

export function validateManualTransaction(
  input: ManualTransactionInput,
  availableQuantity: number | null = null,
) {
  const errors: string[] = []

  if (!input.instrumentId) errors.push('Vyberte instrument.')
  if (!input.cashInstrumentId) errors.push('Vyberte vypořádací účet.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transactionDate)) errors.push('Zadejte platné datum.')
  if (!['BUY', 'SELL'].includes(input.transactionType)) errors.push('Typ transakce musí být BUY nebo SELL.')
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) errors.push('Množství musí být větší než nula.')
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) errors.push('Cena nesmí být záporná.')
  if (!/^[A-Z]{3}$/.test(input.currency)) errors.push('Měna musí být třípísmenný kód.')
  if (!Number.isFinite(input.fxRate) || input.fxRate <= 0) errors.push('FX kurz musí být větší než nula.')
  if (!Number.isFinite(input.feesNative) || input.feesNative < 0) errors.push('Poplatek nesmí být záporný.')
  if (!Number.isFinite(input.taxNative) || input.taxNative < 0) errors.push('Daň nesmí být záporná.')

  if (
    input.transactionType === 'SELL' &&
    availableQuantity !== null &&
    Number.isFinite(availableQuantity) &&
    input.quantity > availableQuantity + 0.000000001
  ) {
    errors.push(`Nelze prodat ${input.quantity} jednotek. Dostupné množství je ${availableQuantity}.`)
  }

  const grossNative = input.quantity * input.unitPrice
  const netNative = input.transactionType === 'BUY'
    ? grossNative + input.feesNative + input.taxNative
    : grossNative - input.feesNative - input.taxNative

  if (input.transactionType === 'SELL' && Number.isFinite(netNative) && netNative <= 0) {
    errors.push('Čistý výnos z prodeje musí být větší než nula.')
  }

  return {
    valid: errors.length === 0,
    errors,
    grossNative,
    netNative,
    amountCzk: netNative * input.fxRate,
  }
}
