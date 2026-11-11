import {
  supabase,
} from '../lib/supabase'

import {
  calculateInvestmentPerformance,
  calculateLedgerByInstrument,
  reconcileLedgerWithPositions,
  type InstrumentLedgerResult,
  type LedgerPosition,
  type LedgerTransaction,
  type LedgerTransactionType,
  type ReconciliationStatus,
} from '../domain/transactionLedger'

const PORTFOLIO_ID =
  '29cc8d4e-7548-45d0-9a11-ae4d53b55d62'

type TransactionRow = {
  id: string

  portfolio_id: string
  instrument_id: string

  transaction_date: string
  transaction_type: string

  quantity:
    | number
    | string

  unit_price:
    | number
    | string

  currency: string

  fx_rate:
    | number
    | string

  fees_czk:
    | number
    | string

  tax_czk:
    | number
    | string

  amount_czk:
    | number
    | string

  source: string

  external_id:
    | string
    | null

  note:
    | string
    | null

  created_at:
    | string
    | null

  instruments:
    | {
        name: string

        ticker:
          | string
          | null
      }
    | Array<{
        name: string

        ticker:
          | string
          | null
      }>
    | null
}

type PositionRow = {
  instrument_id:
    | string
    | null

  quantity:
    | number
    | string
    | null

  current_value:
    | number
    | string
    | null
}

type PositionAggregation = {
  quantity: number
  currentValue: number
}

export type TransactionLedgerInstrument =
  InstrumentLedgerResult & {
    instrumentName: string

    ticker:
      | string
      | null

    positionQuantity:
      | number
      | null

    quantityDifference: number

    reconciliationStatus:
      ReconciliationStatus

    currentValueCzk: number

    unrealizedProfitLossCzk:
      number

    unrealizedReturnPercent:
      | number
      | null

    totalProfitLossCzk:
      number

    totalReturnPercent:
      | number
      | null
  }

export type TransactionLedgerOverview = {
  instruments:
    TransactionLedgerInstrument[]

  transactionCount: number
  instrumentCount: number

  matchedCount: number
  mismatchCount: number
  noPositionCount: number
  noLedgerCount: number

  invalidTransactionCount:
    number

  realizedProfitLossCzk:
    number

  unrealizedProfitLossCzk:
    number

  totalProfitLossCzk:
    number

  remainingCostBasisCzk:
    number

  currentValueCzk:
    number
}

function toFiniteNumber(
  value: unknown,
  fallback = 0
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback
  }

  const number =
    Number(value)

  return Number.isFinite(
    number
  )
    ? number
    : fallback
}

function resolveInstrument(
  value:
    TransactionRow['instruments']
) {
  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ??
      null
    )
  }

  return value
}

function normalizeTransactionType(
  value: string
):
  LedgerTransactionType {
  return (
    value.toUpperCase() ===
    'SELL'
  )
    ? 'SELL'
    : 'BUY'
}

function mapTransaction(
  row: TransactionRow
):
  LedgerTransaction {
  return {
    id:
      row.id,

    portfolioId:
      row.portfolio_id,

    instrumentId:
      row.instrument_id,

    transactionDate:
      row.transaction_date,

    transactionType:
      normalizeTransactionType(
        row.transaction_type
      ),

    quantity:
      toFiniteNumber(
        row.quantity
      ),

    unitPrice:
      toFiniteNumber(
        row.unit_price
      ),

    currency:
      row.currency,

    fxRate:
      toFiniteNumber(
        row.fx_rate
      ),

    feesCzk:
      toFiniteNumber(
        row.fees_czk
      ),

    taxCzk:
      toFiniteNumber(
        row.tax_czk
      ),

    amountCzk:
      toFiniteNumber(
        row.amount_czk
      ),

    createdAt:
      row.created_at,
  }
}

function aggregatePositions(
  rows: PositionRow[]
) {
  const result =
    new Map<
      string,
      PositionAggregation
    >()

  for (
    const row of rows
  ) {
    if (
      !row.instrument_id
    ) {
      continue
    }

    const current =
      result.get(
        row.instrument_id
      ) ?? {
        quantity: 0,
        currentValue: 0,
      }

    current.quantity +=
      toFiniteNumber(
        row.quantity
      )

    current.currentValue +=
      toFiniteNumber(
        row.current_value
      )

    result.set(
      row.instrument_id,
      current
    )
  }

  return result
}

function getStatusOrder(
  status:
    ReconciliationStatus
) {
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

  return order[status]
}

export async function getTransactionLedgerOverview():
  Promise<TransactionLedgerOverview> {
  const [
    transactionsResult,
    positionsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'transactions'
        )
        .select(`
          id,
          portfolio_id,
          instrument_id,
          transaction_date,
          transaction_type,
          quantity,
          unit_price,
          currency,
          fx_rate,
          fees_czk,
          tax_czk,
          amount_czk,
          source,
          external_id,
          note,
          created_at,
          instruments (
            name,
            ticker
          )
        `)
        .eq(
          'portfolio_id',
          PORTFOLIO_ID
        )
        .order(
          'transaction_date',
          {
            ascending: true,
          }
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          'positions'
        )
        .select(`
          instrument_id,
          quantity,
          current_value
        `)
        .eq(
          'portfolio_id',
          PORTFOLIO_ID
        ),
    ])

  if (
    transactionsResult.error
  ) {
    throw transactionsResult.error
  }

  if (
    positionsResult.error
  ) {
    throw positionsResult.error
  }

  const transactionRows =
    (
      transactionsResult.data ??
      []
    ) as unknown as TransactionRow[]

  const positionRows =
    (
      positionsResult.data ??
      []
    ) as unknown as PositionRow[]

  const transactions =
    transactionRows.map(
      mapTransaction
    )

  const ledgerResults =
    calculateLedgerByInstrument(
      transactions
    )

  const positionAggregation =
    aggregatePositions(
      positionRows
    )

  const positions:
    LedgerPosition[] =
      Array.from(
        positionAggregation.entries()
      ).map(
        ([
          instrumentId,
          position,
        ]) => ({
          instrumentId,

          quantity:
            position.quantity,
        })
      )

  const reconciliations =
    reconcileLedgerWithPositions(
      ledgerResults,
      positions
    )

  const reconciliationByInstrument =
    new Map(
      reconciliations.map(
        (reconciliation) => [
          reconciliation.instrumentId,
          reconciliation,
        ]
      )
    )

  const instrumentNameById =
    new Map<
      string,
      {
        name: string

        ticker:
          | string
          | null
      }
    >()

  for (
    const row of
    transactionRows
  ) {
    const instrument =
      resolveInstrument(
        row.instruments
      )

    if (!instrument) {
      continue
    }

    instrumentNameById.set(
      row.instrument_id,
      {
        name:
          instrument.name,

        ticker:
          instrument.ticker,
      }
    )
  }

  const instruments:
    TransactionLedgerInstrument[] =
      ledgerResults.map(
        (ledger) => {
          const identity =
            instrumentNameById.get(
              ledger.instrumentId
            )

          const reconciliation =
            reconciliationByInstrument.get(
              ledger.instrumentId
            )

          const position =
            positionAggregation.get(
              ledger.instrumentId
            )

          const currentValueCzk =
            position
              ?.currentValue ??
            0

          const performance =
            calculateInvestmentPerformance(
              ledger,
              currentValueCzk
            )

          const reconciliationStatus:
            ReconciliationStatus =
              reconciliation
                ?.status ??
              'NO_POSITION'

          return {
            ...ledger,

            instrumentName:
              identity
                ?.name ??
              ledger.instrumentId,

            ticker:
              identity
                ?.ticker ??
              null,

            positionQuantity:
              reconciliation
                ?.positionQuantity ??
              null,

            quantityDifference:
              reconciliation
                ?.difference ??
              -ledger.ledgerQuantity,

            reconciliationStatus,

            currentValueCzk:
              performance
                .currentValueCzk,

            unrealizedProfitLossCzk:
              performance
                .unrealizedProfitLossCzk,

            unrealizedReturnPercent:
              performance
                .unrealizedReturnPercent,

            totalProfitLossCzk:
              performance
                .totalProfitLossCzk,

            totalReturnPercent:
              performance
                .totalReturnPercent,
          }
        }
      )

  instruments.sort(
    (first, second) => {
      const statusDifference =
        getStatusOrder(
          first.reconciliationStatus
        ) -
        getStatusOrder(
          second.reconciliationStatus
        )

      if (
        statusDifference !==
        0
      ) {
        return statusDifference
      }

      return first.instrumentName.localeCompare(
        second.instrumentName,
        'cs'
      )
    }
  )

  const matchedCount =
    instruments.filter(
      (instrument) =>
        instrument.reconciliationStatus ===
        'MATCH'
    ).length

  const mismatchCount =
    instruments.filter(
      (instrument) =>
        instrument.reconciliationStatus ===
        'MISMATCH'
    ).length

  const noPositionCount =
    instruments.filter(
      (instrument) =>
        instrument.reconciliationStatus ===
        'NO_POSITION'
    ).length

  const noLedgerCount =
    reconciliations.filter(
      (reconciliation) =>
        reconciliation.status ===
        'NO_LEDGER'
    ).length

  const invalidTransactionCount =
    instruments.reduce(
      (sum, instrument) =>
        sum +
        instrument
          .invalidTransactionCount,
      0
    )

  const realizedProfitLossCzk =
    instruments.reduce(
      (sum, instrument) =>
        sum +
        instrument
          .realizedProfitLossCzk,
      0
    )

  const unrealizedProfitLossCzk =
    instruments.reduce(
      (sum, instrument) =>
        sum +
        instrument
          .unrealizedProfitLossCzk,
      0
    )

  const totalProfitLossCzk =
    instruments.reduce(
      (sum, instrument) =>
        sum +
        instrument
          .totalProfitLossCzk,
      0
    )

  const remainingCostBasisCzk =
    instruments.reduce(
      (sum, instrument) =>
        sum +
        instrument
          .remainingCostBasisCzk,
      0
    )

  const currentValueCzk =
    instruments.reduce(
      (sum, instrument) =>
        sum +
        instrument
          .currentValueCzk,
      0
    )

  return {
    instruments,

    transactionCount:
      transactions.length,

    instrumentCount:
      instruments.length,

    matchedCount,

    mismatchCount,

    noPositionCount,

    noLedgerCount,

    invalidTransactionCount,

    realizedProfitLossCzk,

    unrealizedProfitLossCzk,

    totalProfitLossCzk,

    remainingCostBasisCzk,

    currentValueCzk,
  }
}