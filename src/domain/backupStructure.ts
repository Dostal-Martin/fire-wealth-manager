export type BackupRow =
  Record<string, unknown>

export type BackupSourceData = {
  instruments: BackupRow[]
  positions: BackupRow[]
  transactions: BackupRow[]
  cashflows: BackupRow[]
  portfolioSnapshots: BackupRow[]
  fireSettings: BackupRow[]
  fxHistory: BackupRow[]
  syncStatus: BackupRow[]
  priceHistory?: BackupRow[]
}

export type FireBackupData = {
  instruments: BackupRow[]
  positions: BackupRow[]
  transactions: BackupRow[]
  cashflows: BackupRow[]
  portfolio_snapshots: BackupRow[]
  fire_settings: BackupRow[]
  fx_history: BackupRow[]
  app_sync_status: BackupRow[]
  price_history?: BackupRow[]
}

export type FireBackup = {
  format:
    'fire-wm-backup'

  version:
    '1.1'

  exportedAt:
    string

  data:
    FireBackupData
}

export function createBackupStructure(
  source: BackupSourceData,
  includePriceHistory: boolean,
  exportedAt =
    new Date().toISOString()
):
  FireBackup {
  return {
    format:
      'fire-wm-backup',

    version:
      '1.1',

    exportedAt,

    data: {
      instruments:
        source.instruments,

      positions:
        source.positions,

      transactions:
        source.transactions,

      cashflows:
        source.cashflows,

      portfolio_snapshots:
        source.portfolioSnapshots,

      fire_settings:
        source.fireSettings,

      fx_history:
        source.fxHistory,

      app_sync_status:
        source.syncStatus,

      ...(includePriceHistory
        ? {
            price_history:
              source.priceHistory ??
              [],
          }
        : {}),
    },
  }
}

export function getBackupCounts(
  backup: FireBackup
) {
  return {
    instruments:
      backup.data
        .instruments.length,

    positions:
      backup.data
        .positions.length,

    transactions:
      backup.data
        .transactions.length,

    cashflows:
      backup.data
        .cashflows.length,

    snapshots:
      backup.data
        .portfolio_snapshots
        .length,

    fxRates:
      backup.data
        .fx_history.length,

    priceHistory:
      backup.data
        .price_history
        ?.length ??
      0,
  }
}