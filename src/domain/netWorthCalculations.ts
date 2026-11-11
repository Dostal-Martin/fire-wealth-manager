export type NetWorthPosition = {
  current_value:
    | number
    | string
    | null
    | undefined
}

export type NetWorthCalculation = {
  assets: number
  liabilities: number
  netWorth: number
  positionCount: number
  validPositionCount: number
  invalidPositionCount: number
}

function normalizeValue(
  value:
    NetWorthPosition['current_value']
):
  number | null {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  const number =
    Number(value)

  return Number.isFinite(number)
    ? number
    : null
}

export function calculateNetWorth(
  positions: NetWorthPosition[]
):
  NetWorthCalculation {
  let assets = 0
  let liabilities = 0
  let validPositionCount = 0
  let invalidPositionCount = 0

  for (
    const position of
    positions
  ) {
    const value =
      normalizeValue(
        position.current_value
      )

    if (value === null) {
      invalidPositionCount += 1
      continue
    }

    validPositionCount += 1

    if (value >= 0) {
      assets += value
    } else {
      liabilities += value
    }
  }

  return {
    assets,

    liabilities,

    netWorth:
      assets +
      liabilities,

    positionCount:
      positions.length,

    validPositionCount,

    invalidPositionCount,
  }
}