export type InternalTransferInput = {
  transferDate: string
  sourceInstrumentId: string
  destinationInstrumentId: string
  sourceAmount: number
  destinationAmount: number
  sourceValueCzk: number
  destinationValueCzk: number
  feeCzk: number
  note: string
}

export function validateInternalTransfer(input: InternalTransferInput) {
  const errors: string[] = []

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transferDate)) errors.push('Zadejte platné datum.')
  if (!input.sourceInstrumentId) errors.push('Vyberte zdrojový účet.')
  if (!input.destinationInstrumentId) errors.push('Vyberte cílový účet.')
  if (input.sourceInstrumentId && input.sourceInstrumentId === input.destinationInstrumentId) errors.push('Zdrojový a cílový účet musí být odlišný.')
  if (!Number.isFinite(input.sourceAmount) || input.sourceAmount <= 0) errors.push('Zdrojová částka musí být větší než nula.')
  if (!Number.isFinite(input.destinationAmount) || input.destinationAmount <= 0) errors.push('Cílová částka musí být větší než nula.')
  if (!Number.isFinite(input.sourceValueCzk) || input.sourceValueCzk <= 0) errors.push('Zdrojová hodnota v CZK musí být větší než nula.')
  if (!Number.isFinite(input.destinationValueCzk) || input.destinationValueCzk <= 0) errors.push('Cílová hodnota v CZK musí být větší než nula.')
  if (!Number.isFinite(input.feeCzk) || input.feeCzk < 0) errors.push('Poplatek nesmí být záporný.')

  const difference = Math.abs(input.sourceValueCzk - input.destinationValueCzk - input.feeCzk)
  if (Number.isFinite(difference) && difference > 1) {
    errors.push('Zdrojová a cílová korunová hodnota se po započtení poplatku neshodují.')
  }

  return { valid: errors.length === 0, errors }
}
