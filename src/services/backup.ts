import {
  supabase,
} from '../lib/supabase'

import {
  createBackupStructure,
  getBackupCounts,
  type BackupRow,
} from '../domain/backupStructure'

import {
  getLocalDateString,
} from './netWorth'

type BackupOptions = {
  includePriceHistory: boolean
}

async function loadAllRows(
  table: string
):
  Promise<BackupRow[]> {
  const pageSize = 1000
  let from = 0

  const result:
    BackupRow[] = []

  while (true) {
    const {
      data,
      error,
    } =
      await supabase
        .from(table)
        .select('*')
        .range(
          from,
          from +
            pageSize -
            1
        )

    if (error) {
      throw error
    }

    const page =
      (
        data ?? []
      ) as BackupRow[]

    result.push(
      ...page
    )

    if (
      page.length <
      pageSize
    ) {
      break
    }

    from +=
      pageSize
  }

  return result
}

export async function createBackup(
  options: BackupOptions
) {
  const [
    instruments,
    positions,
    transactions,
    cashflows,
    portfolioSnapshots,
    fireSettings,
    fxHistory,
    syncStatus,
  ] =
    await Promise.all([
      loadAllRows(
        'instruments'
      ),

      loadAllRows(
        'positions'
      ),

      loadAllRows(
        'transactions'
      ),

      loadAllRows(
        'cashflows'
      ),

      loadAllRows(
        'portfolio_snapshots'
      ),

      loadAllRows(
        'fire_settings'
      ),

      loadAllRows(
        'fx_history'
      ),

      loadAllRows(
        'app_sync_status'
      ),
    ])

  let priceHistory:
    BackupRow[] | undefined

  if (
    options
      .includePriceHistory
  ) {
    priceHistory =
      await loadAllRows(
        'price_history'
      )
  }

  return createBackupStructure(
    {
      instruments,

      positions,

      transactions,

      cashflows,

      portfolioSnapshots,

      fireSettings,

      fxHistory,

      syncStatus,

      priceHistory,
    },

    options
      .includePriceHistory
  )
}

function backupFileName() {
  return (
    `fire-wm-backup-${getLocalDateString()}.json`
  )
}

export async function downloadBackup(
  options: BackupOptions
) {
  const backup =
    await createBackup(
      options
    )

  const json =
    JSON.stringify(
      backup,
      null,
      2
    )

  const blob =
    new Blob(
      [json],
      {
        type:
          'application/json;charset=utf-8',
      }
    )

  const url =
    URL.createObjectURL(
      blob
    )

  const link =
    document.createElement(
      'a'
    )

  link.href =
    url

  const fileName =
    backupFileName()

  link.download =
    fileName

  document.body.appendChild(
    link
  )

  link.click()

  link.remove()

  URL.revokeObjectURL(
    url
  )

  const counts =
    getBackupCounts(
      backup
    )

  return {
    fileName,

    sizeBytes:
      blob.size,

    includedPriceHistory:
      options
        .includePriceHistory,

    counts,
  }
}