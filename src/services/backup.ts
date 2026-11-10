import { supabase } from '../lib/supabase'

type BackupOptions = {
  includePriceHistory: boolean
}

async function loadAllRows(
  table: string,
) {
  const pageSize = 1000
  let from = 0

  const result: any[] = []

  while (true) {
    const {
      data,
      error,
    } = await supabase
      .from(table)
      .select('*')
      .range(
        from,
        from + pageSize - 1
      )

    if (error) {
      throw error
    }

    const page =
      data ?? []

    result.push(
      ...page
    )

    if (
      page.length <
      pageSize
    ) {
      break
    }

    from =
      from + pageSize
  }

  return result
}

export async function createBackup(
  options: BackupOptions
) {
  const [
    instruments,
    positions,
    cashflows,
    portfolioSnapshots,
    fireSettings,
    fxHistory,
    syncStatus,
  ] = await Promise.all([
    loadAllRows(
      'instruments'
    ),

    loadAllRows(
      'positions'
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
    any[] | undefined

  if (
    options
      .includePriceHistory
  ) {
    priceHistory =
      await loadAllRows(
        'price_history'
      )
  }

  return {
    format:
      'fire-wm-backup',

    version:
      '1.0',

    exportedAt:
      new Date()
        .toISOString(),

    data: {
      instruments,

      positions,

      cashflows,

      portfolio_snapshots:
        portfolioSnapshots,

      fire_settings:
        fireSettings,

      fx_history:
        fxHistory,

      app_sync_status:
        syncStatus,

      ...(options
        .includePriceHistory
        ? {
            price_history:
              priceHistory ??
              [],
          }
        : {}),
    },
  }
}

function backupFileName() {
  const today =
    new Date()
      .toISOString()
      .slice(0, 10)

  return (
    `fire-wm-backup-${today}.json`
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

  link.href = url

  link.download =
    backupFileName()

  document.body.appendChild(
    link
  )

  link.click()

  link.remove()

  URL.revokeObjectURL(
    url
  )

  return {
    fileName:
      backupFileName(),

    sizeBytes:
      blob.size,

    includedPriceHistory:
      options
        .includePriceHistory,

    counts: {
      instruments:
        backup.data
          .instruments.length,

      positions:
        backup.data
          .positions.length,

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
        options
          .includePriceHistory
          ? (
              backup.data as any
            )
              .price_history
              ?.length ??
            0
          : 0,
    },
  }
}