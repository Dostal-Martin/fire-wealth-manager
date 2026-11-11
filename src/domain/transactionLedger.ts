export type LedgerTransactionType =
  | 'BUY'
  | 'SELL'

export type LedgerTransaction = {
  id: string
  portfolioId: string
  instrumentId: string
  transactionDate: string
  transactionType:
    LedgerTransactionType

  quantity: number
  unitPrice: number
  currency: string
  fxRate: number

  feesCzk: number
  taxCzk: number
  amountCzk: number

  createdAt?:
    string | null
}

export type LedgerIssueCode =
  | 'INVALID_TRANSACTION'
  | 'OVERSOLD_POSITION'

export type LedgerIssue = {
  transactionId: string
  instrumentId: string
  transactionDate: string
  code:
    LedgerIssueCode
  message: string
}

export type ProcessedLedgerTransaction = {
  id: string
  transactionDate: string
  transactionType:
    LedgerTransactionType

  quantity: number
  amountCzk: number

  quantityBefore: number
  quantityAfter: number

  averageCostBefore: number
  averageCostAfter: number

  costBasisBefore: number
  costBasisAfter: number

  disposedCostBasis: number

  realizedProfitLoss:
    number | null

  valid: boolean
}

export type InstrumentLedgerResult = {
  portfolioId: string
  instrumentId: string

  buyQuantity: number
  sellQuantity: number
  ledgerQuantity: number

  totalBuyAmountCzk: number
  totalSellAmountCzk: number

  remainingCostBasisCzk: number
  averageCostCzk: number

  realizedProfitLossCzk: number
  incomeFromSalesCzk: number

  processedTransactionCount:
    number

  invalidTransactionCount:
    number

  transactions:
    ProcessedLedgerTransaction[]

  issues:
    LedgerIssue[]
}

export type InstrumentInvestmentPerformance = {
  currentValueCzk: number

  unrealizedProfitLossCzk:
    number

  unrealizedReturnPercent:
    number | null

  realizedProfitLossCzk:
    number

  totalProfitLossCzk:
    number

  totalReturnPercent:
    number | null
}

export type ReconciliationStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'NO_POSITION'
  | 'NO_LEDGER'

export type LedgerReconciliation = {
  instrumentId: string

  positionQuantity:
    number | null

  ledgerQuantity: number

  difference: number
  absoluteDifference: number

  tolerance: number

  status:
    ReconciliationStatus
}

export type LedgerPosition = {
  instrumentId: string
  quantity:
    number | null
}

const DEFAULT_TOLERANCE =
  0.01

const FLOATING_POINT_TOLERANCE =
  0.000000001

function normalizeNumber(
  value: number
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0
  }

  if (
    Math.abs(value) <
    FLOATING_POINT_TOLERANCE
  ) {
    return 0
  }

  return value
}

function compareTransactions(
  first:
    LedgerTransaction,
  second:
    LedgerTransaction
) {
  const dateComparison =
    first.transactionDate.localeCompare(
      second.transactionDate
    )

  if (
    dateComparison !== 0
  ) {
    return dateComparison
  }

  const createdComparison =
    (
      first.createdAt ??
      ''
    ).localeCompare(
      second.createdAt ??
      ''
    )

  if (
    createdComparison !== 0
  ) {
    return createdComparison
  }

  return first.id.localeCompare(
    second.id
  )
}

function isValidTransaction(
  transaction:
    LedgerTransaction
) {
  return (
    Boolean(
      transaction.id
    ) &&
    Boolean(
      transaction.portfolioId
    ) &&
    Boolean(
      transaction.instrumentId
    ) &&
    Boolean(
      transaction.transactionDate
    ) &&
    (
      transaction.transactionType ===
        'BUY' ||
      transaction.transactionType ===
        'SELL'
    ) &&
    Number.isFinite(
      transaction.quantity
    ) &&
    transaction.quantity >
      0 &&
    Number.isFinite(
      transaction.unitPrice
    ) &&
    transaction.unitPrice >=
      0 &&
    Number.isFinite(
      transaction.fxRate
    ) &&
    transaction.fxRate >
      0 &&
    Number.isFinite(
      transaction.feesCzk
    ) &&
    transaction.feesCzk >=
      0 &&
    Number.isFinite(
      transaction.taxCzk
    ) &&
    transaction.taxCzk >=
      0 &&
    Number.isFinite(
      transaction.amountCzk
    ) &&
    transaction.amountCzk >
      0
  )
}

function createInvalidTransactionIssue(
  transaction:
    LedgerTransaction
):
  LedgerIssue {
  return {
    transactionId:
      transaction.id,

    instrumentId:
      transaction.instrumentId,

    transactionDate:
      transaction.transactionDate,

    code:
      'INVALID_TRANSACTION',

    message:
      'Transakce obsahuje neplatné množství, cenu, kurz nebo částku.',
  }
}

function createOversoldIssue(
  transaction:
    LedgerTransaction,
  availableQuantity:
    number
):
  LedgerIssue {
  return {
    transactionId:
      transaction.id,

    instrumentId:
      transaction.instrumentId,

    transactionDate:
      transaction.transactionDate,

    code:
      'OVERSOLD_POSITION',

    message:
      `Prodej ${transaction.quantity} jednotek překračuje dostupné množství ${availableQuantity}.`,
  }
}

export function calculateInstrumentLedger(
  transactions:
    LedgerTransaction[]
):
  InstrumentLedgerResult {
  const firstTransaction =
    transactions[0]

  const portfolioId =
    firstTransaction
      ?.portfolioId ??
    ''

  const instrumentId =
    firstTransaction
      ?.instrumentId ??
    ''

  const sortedTransactions =
    [...transactions].sort(
      compareTransactions
    )

  let buyQuantity = 0
  let sellQuantity = 0

  let ledgerQuantity = 0

  let remainingCostBasisCzk =
    0

  let totalBuyAmountCzk =
    0

  let totalSellAmountCzk =
    0

  let realizedProfitLossCzk =
    0

  let processedTransactionCount =
    0

  let invalidTransactionCount =
    0

  const processedTransactions:
    ProcessedLedgerTransaction[] =
      []

  const issues:
    LedgerIssue[] = []

  for (
    const transaction of
    sortedTransactions
  ) {
    const quantityBefore =
      ledgerQuantity

    const costBasisBefore =
      remainingCostBasisCzk

    const averageCostBefore =
      quantityBefore > 0
        ? costBasisBefore /
          quantityBefore
        : 0

    if (
      !isValidTransaction(
        transaction
      )
    ) {
      invalidTransactionCount +=
        1

      issues.push(
        createInvalidTransactionIssue(
          transaction
        )
      )

      processedTransactions.push({
        id:
          transaction.id,

        transactionDate:
          transaction.transactionDate,

        transactionType:
          transaction.transactionType,

        quantity:
          transaction.quantity,

        amountCzk:
          transaction.amountCzk,

        quantityBefore,

        quantityAfter:
          quantityBefore,

        averageCostBefore,

        averageCostAfter:
          averageCostBefore,

        costBasisBefore,

        costBasisAfter:
          costBasisBefore,

        disposedCostBasis:
          0,

        realizedProfitLoss:
          null,

        valid:
          false,
      })

      continue
    }

    if (
      transaction
        .transactionType ===
      'BUY'
    ) {
      buyQuantity +=
        transaction.quantity

      totalBuyAmountCzk +=
        transaction.amountCzk

      ledgerQuantity +=
        transaction.quantity

      /*
       * amountCzk představuje skutečně
       * zaúčtovanou pořizovací cenu.
       */
      remainingCostBasisCzk +=
        transaction.amountCzk

      ledgerQuantity =
        normalizeNumber(
          ledgerQuantity
        )

      remainingCostBasisCzk =
        normalizeNumber(
          remainingCostBasisCzk
        )

      const averageCostAfter =
        ledgerQuantity > 0
          ? remainingCostBasisCzk /
            ledgerQuantity
          : 0

      processedTransactionCount +=
        1

      processedTransactions.push({
        id:
          transaction.id,

        transactionDate:
          transaction.transactionDate,

        transactionType:
          transaction.transactionType,

        quantity:
          transaction.quantity,

        amountCzk:
          transaction.amountCzk,

        quantityBefore,

        quantityAfter:
          ledgerQuantity,

        averageCostBefore,

        averageCostAfter,

        costBasisBefore,

        costBasisAfter:
          remainingCostBasisCzk,

        disposedCostBasis:
          0,

        realizedProfitLoss:
          null,

        valid:
          true,
      })

      continue
    }

    if (
      transaction.quantity >
      ledgerQuantity +
        FLOATING_POINT_TOLERANCE
    ) {
      invalidTransactionCount +=
        1

      issues.push(
        createOversoldIssue(
          transaction,
          ledgerQuantity
        )
      )

      processedTransactions.push({
        id:
          transaction.id,

        transactionDate:
          transaction.transactionDate,

        transactionType:
          transaction.transactionType,

        quantity:
          transaction.quantity,

        amountCzk:
          transaction.amountCzk,

        quantityBefore,

        quantityAfter:
          quantityBefore,

        averageCostBefore,

        averageCostAfter:
          averageCostBefore,

        costBasisBefore,

        costBasisAfter:
          costBasisBefore,

        disposedCostBasis:
          0,

        realizedProfitLoss:
          null,

        valid:
          false,
      })

      continue
    }

    const disposedCostBasis =
      averageCostBefore *
      transaction.quantity

    const transactionRealizedProfitLoss =
      transaction.amountCzk -
      disposedCostBasis

    sellQuantity +=
      transaction.quantity

    totalSellAmountCzk +=
      transaction.amountCzk

    realizedProfitLossCzk +=
      transactionRealizedProfitLoss

    ledgerQuantity -=
      transaction.quantity

    remainingCostBasisCzk -=
      disposedCostBasis

    ledgerQuantity =
      normalizeNumber(
        ledgerQuantity
      )

    remainingCostBasisCzk =
      normalizeNumber(
        remainingCostBasisCzk
      )

    if (
      ledgerQuantity === 0
    ) {
      remainingCostBasisCzk =
        0
    }

    const averageCostAfter =
      ledgerQuantity > 0
        ? remainingCostBasisCzk /
          ledgerQuantity
        : 0

    processedTransactionCount +=
      1

    processedTransactions.push({
      id:
        transaction.id,

      transactionDate:
        transaction.transactionDate,

      transactionType:
        transaction.transactionType,

      quantity:
        transaction.quantity,

      amountCzk:
        transaction.amountCzk,

      quantityBefore,

      quantityAfter:
        ledgerQuantity,

      averageCostBefore,

      averageCostAfter,

      costBasisBefore,

      costBasisAfter:
        remainingCostBasisCzk,

      disposedCostBasis,

      realizedProfitLoss:
        transactionRealizedProfitLoss,

      valid:
        true,
    })
  }

  const averageCostCzk =
    ledgerQuantity > 0
      ? remainingCostBasisCzk /
        ledgerQuantity
      : 0

  return {
    portfolioId,

    instrumentId,

    buyQuantity:
      normalizeNumber(
        buyQuantity
      ),

    sellQuantity:
      normalizeNumber(
        sellQuantity
      ),

    ledgerQuantity:
      normalizeNumber(
        ledgerQuantity
      ),

    totalBuyAmountCzk:
      normalizeNumber(
        totalBuyAmountCzk
      ),

    totalSellAmountCzk:
      normalizeNumber(
        totalSellAmountCzk
      ),

    remainingCostBasisCzk:
      normalizeNumber(
        remainingCostBasisCzk
      ),

    averageCostCzk:
      normalizeNumber(
        averageCostCzk
      ),

    realizedProfitLossCzk:
      normalizeNumber(
        realizedProfitLossCzk
      ),

    incomeFromSalesCzk:
      normalizeNumber(
        totalSellAmountCzk
      ),

    processedTransactionCount,

    invalidTransactionCount,

    transactions:
      processedTransactions,

    issues,
  }
}

export function calculateInvestmentPerformance(
  ledger:
    InstrumentLedgerResult,
  currentValueCzk:
    number
):
  InstrumentInvestmentPerformance {
  const normalizedCurrentValue =
    Number.isFinite(
      currentValueCzk
    )
      ? currentValueCzk
      : 0

  const unrealizedProfitLossCzk =
    normalizedCurrentValue -
    ledger.remainingCostBasisCzk

  const unrealizedReturnPercent =
    ledger.remainingCostBasisCzk >
    0
      ? (
          unrealizedProfitLossCzk /
          ledger.remainingCostBasisCzk
        ) * 100
      : null

  const totalProfitLossCzk =
    ledger.realizedProfitLossCzk +
    unrealizedProfitLossCzk

  /*
   * Jednoduchý souhrnný obchodní výnos.
   *
   * Nejde o XIRR ani TWR.
   * Jmenovatelem je historická suma
   * pořizovacích částek BUY.
   *
   * Dividendový a kupónový příjem
   * zatím není zahrnut.
   */
  const totalReturnPercent =
    ledger.totalBuyAmountCzk >
    0
      ? (
          totalProfitLossCzk /
          ledger.totalBuyAmountCzk
        ) * 100
      : null

  return {
    currentValueCzk:
      normalizedCurrentValue,

    unrealizedProfitLossCzk:
      normalizeNumber(
        unrealizedProfitLossCzk
      ),

    unrealizedReturnPercent,

    realizedProfitLossCzk:
      ledger.realizedProfitLossCzk,

    totalProfitLossCzk:
      normalizeNumber(
        totalProfitLossCzk
      ),

    totalReturnPercent,
  }
}

export function calculateLedgerByInstrument(
  transactions:
    LedgerTransaction[]
) {
  const groups =
    new Map<
      string,
      LedgerTransaction[]
    >()

  for (
    const transaction of
    transactions
  ) {
    const key =
      [
        transaction.portfolioId,
        transaction.instrumentId,
      ].join(':')

    const current =
      groups.get(key) ??
      []

    current.push(
      transaction
    )

    groups.set(
      key,
      current
    )
  }

  return Array.from(
    groups.values()
  )
    .map(
      (
        instrumentTransactions
      ) =>
        calculateInstrumentLedger(
          instrumentTransactions
        )
    )
    .sort(
      (a, b) =>
        a.instrumentId.localeCompare(
          b.instrumentId
        )
    )
}

export function reconcileLedgerQuantity(
  instrumentId:
    string,
  ledgerQuantity:
    number,
  positionQuantity:
    number | null,
  tolerance =
    DEFAULT_TOLERANCE
):
  LedgerReconciliation {
  const normalizedTolerance =
    Number.isFinite(
      tolerance
    )
      ? Math.max(
          tolerance,
          0
        )
      : DEFAULT_TOLERANCE

  if (
    positionQuantity ===
    null
  ) {
    return {
      instrumentId,

      positionQuantity:
        null,

      ledgerQuantity,

      difference:
        -ledgerQuantity,

      absoluteDifference:
        Math.abs(
          ledgerQuantity
        ),

      tolerance:
        normalizedTolerance,

      status:
        'NO_POSITION',
    }
  }

  const difference =
    positionQuantity -
    ledgerQuantity

  const absoluteDifference =
    Math.abs(
      difference
    )

  return {
    instrumentId,

    positionQuantity,

    ledgerQuantity,

    difference,

    absoluteDifference,

    tolerance:
      normalizedTolerance,

    status:
      absoluteDifference <=
      normalizedTolerance
        ? 'MATCH'
        : 'MISMATCH',
  }
}

export function reconcileLedgerWithPositions(
  ledgerResults:
    InstrumentLedgerResult[],
  positions:
    LedgerPosition[],
  tolerance =
    DEFAULT_TOLERANCE
) {
  const positionByInstrument =
    new Map<
      string,
      number | null
    >()

  for (
    const position of
    positions
  ) {
    positionByInstrument.set(
      position.instrumentId,
      position.quantity
    )
  }

  const reconciliations:
    LedgerReconciliation[] =
      []

  const processedInstrumentIds =
    new Set<string>()

  for (
    const ledger of
    ledgerResults
  ) {
    processedInstrumentIds.add(
      ledger.instrumentId
    )

    const hasPosition =
      positionByInstrument.has(
        ledger.instrumentId
      )

    const positionQuantity =
      hasPosition
        ? positionByInstrument.get(
            ledger.instrumentId
          ) ?? null
        : null

    reconciliations.push(
      reconcileLedgerQuantity(
        ledger.instrumentId,
        ledger.ledgerQuantity,
        positionQuantity,
        tolerance
      )
    )
  }

  for (
    const position of
    positions
  ) {
    if (
      processedInstrumentIds.has(
        position.instrumentId
      )
    ) {
      continue
    }

    const positionQuantity =
      position.quantity ??
      0

    reconciliations.push({
      instrumentId:
        position.instrumentId,

      positionQuantity:
        position.quantity,

      ledgerQuantity:
        0,

      difference:
        positionQuantity,

      absoluteDifference:
        Math.abs(
          positionQuantity
        ),

      tolerance,

      status:
        'NO_LEDGER',
    })
  }

  return reconciliations.sort(
    (a, b) => {
      const order:
        Record<
          ReconciliationStatus,
          number
        > = {
          MISMATCH: 0,
          NO_POSITION: 1,
          NO_LEDGER: 2,
          MATCH: 3,
        }

      const statusDifference =
        order[a.status] -
        order[b.status]

      if (
        statusDifference !== 0
      ) {
        return statusDifference
      }

      return (
        b.absoluteDifference -
        a.absoluteDifference
      )
    }
  )
}