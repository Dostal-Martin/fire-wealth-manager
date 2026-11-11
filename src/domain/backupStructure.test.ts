import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  createBackupStructure,
  getBackupCounts,
  type BackupSourceData,
} from './backupStructure'

function createSource():
  BackupSourceData {
  return {
    instruments: [
      {
        id:
          'instrument-1',

        name:
          'Test ETF',
      },
    ],

    positions: [
      {
        id:
          'position-1',

        instrument_id:
          'instrument-1',

        quantity:
          10,

        current_value:
          100000,

        valuation_date:
          '2026-11-11',
      },
    ],

    transactions: [
      {
        id:
          'transaction-1',

        portfolio_id:
          'portfolio-1',

        instrument_id:
          'instrument-1',

        transaction_date:
          '2026-01-01',

        transaction_type:
          'BUY',

        quantity:
          10,

        unit_price:
          100,

        currency:
          'CZK',

        fx_rate:
          1,

        fees_czk:
          0,

        tax_czk:
          0,

        amount_czk:
          1000,

        source:
          'migration',

        external_id:
          'cashflow-1',
      },
    ],

    cashflows: [
      {
        id:
          'cashflow-1',

        transaction_date:
          '2026-01-01',

        amount_czk:
          -1000,

        is_external:
          false,

        transaction_type:
          'BUY',
      },
    ],

    portfolioSnapshots: [
      {
        id:
          'snapshot-1',

        snapshot_date:
          '2026-01-01',

        net_worth:
          100000,
      },
    ],

    fireSettings: [
      {
        portfolio_id:
          'portfolio-1',

        target_fire_number:
          25000000,
      },
    ],

    fxHistory: [
      {
        fx_date:
          '2026-01-01',

        currency:
          'USD',

        rate:
          24.5,
      },
    ],

    syncStatus: [
      {
        sync_key:
          'market_prices',
      },
    ],

    priceHistory: [
      {
        instrument_id:
          'instrument-1',

        price_date:
          '2026-01-01',

        close_price:
          100,
      },
    ],
  }
}

describe(
  'createBackupStructure',
  () => {
    it(
      'vytvoří backup formátu 1.1',
      () => {
        const backup =
          createBackupStructure(
            createSource(),
            false,
            '2026-11-11T10:00:00.000Z'
          )

        expect(
          backup.format
        ).toBe(
          'fire-wm-backup'
        )

        expect(
          backup.version
        ).toBe(
          '1.1'
        )

        expect(
          backup.exportedAt
        ).toBe(
          '2026-11-11T10:00:00.000Z'
        )
      }
    )

    it(
      'obsahuje všechny povinné sekce včetně transactions',
      () => {
        const backup =
          createBackupStructure(
            createSource(),
            false
          )

        expect(
          Object.keys(
            backup.data
          ).sort()
        ).toEqual(
          [
            'app_sync_status',
            'cashflows',
            'fire_settings',
            'fx_history',
            'instruments',
            'portfolio_snapshots',
            'positions',
            'transactions',
          ].sort()
        )
      }
    )

    it(
      'zachová transaction ledger',
      () => {
        const backup =
          createBackupStructure(
            createSource(),
            false
          )

        expect(
          backup.data
            .transactions
        ).toHaveLength(1)

        expect(
          backup.data
            .transactions[0]
        ).toMatchObject({
          transaction_type:
            'BUY',

          quantity:
            10,

          unit_price:
            100,

          amount_czk:
            1000,

          source:
            'migration',

          external_id:
            'cashflow-1',
        })
      }
    )

    it(
      'zachová transactions a původní cashflows odděleně',
      () => {
        const backup =
          createBackupStructure(
            createSource(),
            false
          )

        expect(
          backup.data
            .transactions
        ).toHaveLength(1)

        expect(
          backup.data
            .cashflows
        ).toHaveLength(1)

        expect(
          backup.data
            .transactions[0]
            .id
        ).toBe(
          'transaction-1'
        )

        expect(
          backup.data
            .cashflows[0]
            .id
        ).toBe(
          'cashflow-1'
        )
      }
    )

    it(
      'bez volby nezahrnuje price_history',
      () => {
        const backup =
          createBackupStructure(
            createSource(),
            false
          )

        expect(
          backup.data
            .price_history
        ).toBeUndefined()
      }
    )

    it(
      'volitelně zahrne price_history',
      () => {
        const backup =
          createBackupStructure(
            createSource(),
            true
          )

        expect(
          backup.data
            .price_history
        ).toHaveLength(1)
      }
    )

    it(
      'při chybějící price_history vytvoří prázdné pole',
      () => {
        const source =
          createSource()

        delete source
          .priceHistory

        const backup =
          createBackupStructure(
            source,
            true
          )

        expect(
          backup.data
            .price_history
        ).toEqual([])
      }
    )

    it(
      'zachová valuation_date pozice',
      () => {
        const backup =
          createBackupStructure(
            createSource(),
            false
          )

        expect(
          backup.data
            .positions[0]
            .valuation_date
        ).toBe(
          '2026-11-11'
        )
      }
    )
  }
)

describe(
  'getBackupCounts',
  () => {
    it(
      'spočítá transactions samostatně',
      () => {
        const backup =
          createBackupStructure(
            createSource(),
            true
          )

        expect(
          getBackupCounts(
            backup
          )
        ).toEqual({
          instruments: 1,
          positions: 1,
          transactions: 1,
          cashflows: 1,
          snapshots: 1,
          fxRates: 1,
          priceHistory: 1,
        })
      }
    )

    it(
      'vrátí nulu pro nezahrnutou historii cen',
      () => {
        const backup =
          createBackupStructure(
            createSource(),
            false
          )

        expect(
          getBackupCounts(
            backup
          ).priceHistory
        ).toBe(0)
      }
    )
  }
)