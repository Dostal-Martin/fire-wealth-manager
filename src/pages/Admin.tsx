import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  importSnapshots,
} from '../services/importSnapshots'

import {
  importCashflow,
} from '../services/importCashflow'

import {
  downloadBackup,
} from '../services/backup'

import {
  getCurrentNetWorth,
  getLatestSnapshot,
  getLocalDateString,
  saveTodaySnapshot,
} from '../services/netWorth'

type Operation =
  | 'history'
  | 'cashflow'
  | 'backup'
  | 'snapshot'
  | null

type MessageType =
  | 'info'
  | 'success'
  | 'error'

type NetWorthCheck = {
  liveNetWorth: number
  snapshotNetWorth: number | null
  snapshotDate: string | null
  difference: number | null
  differencePercent: number | null
  matches: boolean
  hasTodaySnapshot: boolean
}

function formatBytes(
  bytes: number
) {
  if (
    bytes >=
    1024 * 1024
  ) {
    return `${(
      bytes /
      1024 /
      1024
    ).toLocaleString(
      'cs-CZ',
      {
        maximumFractionDigits:
          1,
      }
    )} MB`
  }

  if (bytes >= 1024) {
    return `${(
      bytes /
      1024
    ).toLocaleString(
      'cs-CZ',
      {
        maximumFractionDigits:
          0,
      }
    )} kB`
  }

  return `${bytes} B`
}

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    'cs-CZ',
    {
      style: 'currency',
      currency: 'CZK',
      maximumFractionDigits: 0,
    }
  ).format(value)
}

function formatPercent(
  value: number
) {
  const prefix =
    value > 0
      ? '+'
      : ''

  return `${prefix}${value.toLocaleString(
    'cs-CZ',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )} %`
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const date =
    new Date(
      `${value}T12:00:00`
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return date.toLocaleDateString(
    'cs-CZ'
  )
}

export default function Admin() {
  const [
    runningOperation,
    setRunningOperation,
  ] =
    useState<Operation>(
      null
    )

  const [
    includePriceHistory,
    setIncludePriceHistory,
  ] =
    useState(false)

  const [
    message,
    setMessage,
  ] =
    useState('')

  const [
    messageType,
    setMessageType,
  ] =
    useState<MessageType>(
      'info'
    )

  const [
    netWorthCheck,
    setNetWorthCheck,
  ] =
    useState<NetWorthCheck | null>(
      null
    )

  const [
    loadingNetWorthCheck,
    setLoadingNetWorthCheck,
  ] =
    useState(true)

  const [
    netWorthCheckError,
    setNetWorthCheckError,
  ] =
    useState('')

  const busy =
    runningOperation !==
    null

  const loadNetWorthCheck =
    useCallback(async () => {
      try {
        setLoadingNetWorthCheck(
          true
        )

        setNetWorthCheckError(
          ''
        )

        const [
          current,
          latestSnapshot,
        ] =
          await Promise.all([
            getCurrentNetWorth(),
            getLatestSnapshot(),
          ])

        const today =
          getLocalDateString()

        const hasTodaySnapshot =
          latestSnapshot !==
            null &&
          latestSnapshot.date ===
            today

        const snapshotNetWorth:
          number | null =
            hasTodaySnapshot &&
            latestSnapshot !==
              null
              ? latestSnapshot.value
              : null

        let difference:
          number | null =
            null

        let differencePercent:
          number | null =
            null

        if (
          snapshotNetWorth !==
          null
        ) {
          difference =
            current.netWorth -
            snapshotNetWorth

          if (
            snapshotNetWorth !==
            0
          ) {
            differencePercent =
              (
                difference /
                Math.abs(
                  snapshotNetWorth
                )
              ) * 100
          } else if (
            difference === 0
          ) {
            differencePercent =
              0
          }
        }

        const matches =
          difference !== null &&
          Math.abs(
            difference
          ) < 0.01

        setNetWorthCheck({
          liveNetWorth:
            current.netWorth,

          snapshotNetWorth,

          snapshotDate:
            latestSnapshot
              ?.date ??
            null,

          difference,

          differencePercent,

          matches,

          hasTodaySnapshot,
        })
      } catch (error) {
        console.error(
          'Net worth consistency:',
          error
        )

        setNetWorthCheckError(
          'Konsistenční kontrolu se nepodařilo načíst.'
        )
      } finally {
        setLoadingNetWorthCheck(
          false
        )
      }
    }, [])

  useEffect(() => {
    loadNetWorthCheck()
  }, [loadNetWorthCheck])

  async function handleImportHistory() {
    try {
      setRunningOperation(
        'history'
      )

      setMessageType(
        'info'
      )

      setMessage(
        'Importuji historii majetku...'
      )

      const count =
        await importSnapshots()

      await loadNetWorthCheck()

      setMessageType(
        'success'
      )

      setMessage(
        `Import historie dokončen. Zpracováno ${count.toLocaleString(
          'cs-CZ'
        )} snapshotů.`
      )
    } catch (error) {
      console.error(
        'Snapshot import:',
        error
      )

      setMessageType(
        'error'
      )

      setMessage(
        'Import historie majetku se nepodařil.'
      )
    } finally {
      setRunningOperation(
        null
      )
    }
  }

  async function handleImportCashflow() {
    try {
      setRunningOperation(
        'cashflow'
      )

      setMessageType(
        'info'
      )

      setMessage(
        'Importuji cashflow...'
      )

      const count =
        await importCashflow()

      setMessageType(
        'success'
      )

      setMessage(
        `Import cashflow dokončen. Zpracováno ${count.toLocaleString(
          'cs-CZ'
        )} transakcí.`
      )
    } catch (error) {
      console.error(
        'Cashflow import:',
        error
      )

      setMessageType(
        'error'
      )

      setMessage(
        'Import cashflow se nepodařil.'
      )
    } finally {
      setRunningOperation(
        null
      )
    }
  }

  async function handleBackup() {
    try {
      setRunningOperation(
        'backup'
      )

      setMessageType(
        'info'
      )

      setMessage(
        'Připravuji zálohu...'
      )

      const result =
        await downloadBackup({
          includePriceHistory,
        })

      setMessageType(
        'success'
      )

      const priceInfo =
        result
          .includedPriceHistory
          ? `, ${result.counts.priceHistory.toLocaleString(
              'cs-CZ'
            )} cen`
          : ''

      setMessage(
        `Záloha ${result.fileName} byla vytvořena. ` +
        `${result.counts.instruments} instrumentů, ` +
        `${result.counts.positions} pozic, ` +
        `${result.counts.cashflows} cashflow záznamů, ` +
        `${result.counts.snapshots} snapshotů${priceInfo}. ` +
        `Velikost ${formatBytes(
          result.sizeBytes
        )}.`
      )
    } catch (error) {
      console.error(
        'Backup:',
        error
      )

      setMessageType(
        'error'
      )

      setMessage(
        'Zálohu se nepodařilo vytvořit.'
      )
    } finally {
      setRunningOperation(
        null
      )
    }
  }

  async function handleUpdateTodaySnapshot() {
    try {
      setRunningOperation(
        'snapshot'
      )

      setMessageType(
        'info'
      )

      setMessage(
        'Aktualizuji dnešní snapshot...'
      )

      const result =
        await saveTodaySnapshot()

      await loadNetWorthCheck()

      setMessageType(
        'success'
      )

      setMessage(
        `Dnešní snapshot byl aktualizován na ${formatMoney(
          result.netWorth
        )}.`
      )
    } catch (error) {
      console.error(
        'Snapshot update:',
        error
      )

      setMessageType(
        'error'
      )

      setMessage(
        'Dnešní snapshot se nepodařilo aktualizovat.'
      )
    } finally {
      setRunningOperation(
        null
      )
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            Správa dat
          </h1>

          <p className="page-subtitle">
            Zálohování, historické
            importy a servisní
            operace aplikace.
          </p>
        </div>
      </header>

      <section className="admin-grid">
        <DataOperation
          title="Záloha dat"
          description={
            <>
              Exportuje současný stav
              aplikace do jednoho JSON
              souboru uloženého na tvém
              zařízení.
            </>
          }
          detail="fire-wm-backup-YYYY-MM-DD.json"
        >
          <label className="admin-backup-option">
            <input
              type="checkbox"
              checked={
                includePriceHistory
              }
              onChange={(event) =>
                setIncludePriceHistory(
                  event.target
                    .checked
                )
              }
            />

            <span>
              <strong>
                Zahrnout historii cen
              </strong>

              <small>
                Výrazně zvětší soubor.
                Yahoo historii lze v
                případě potřeby znovu
                stáhnout.
              </small>
            </span>
          </label>

          <button
            className="button-primary"
            onClick={
              handleBackup
            }
            disabled={busy}
          >
            {runningOperation ===
            'backup'
              ? 'Připravuji zálohu...'
              : 'Exportovat zálohu'}
          </button>
        </DataOperation>

        <DataOperation
          title="Historie majetku"
          description={
            <>
              Import historických
              snapshotů čistého jmění
              ze zdrojových dat.
            </>
          }
          detail="portfolio_snapshots"
        >
          <button
            className="button-secondary"
            onClick={
              handleImportHistory
            }
            disabled={busy}
          >
            {runningOperation ===
            'history'
              ? 'Importuji...'
              : 'Importovat historii'}
          </button>
        </DataOperation>

        <DataOperation
          title="Cashflow"
          description={
            <>
              Import historických
              nákupů, prodejů,
              dividend a kupónových
              plateb.
            </>
          }
          detail="cashflows"
        >
          <button
            className="button-secondary"
            onClick={
              handleImportCashflow
            }
            disabled={busy}
          >
            {runningOperation ===
            'cashflow'
              ? 'Importuji...'
              : 'Importovat cashflow'}
          </button>
        </DataOperation>
      </section>

      {message && (
        <div
          className={[
            'admin-status',

            messageType ===
            'success'
              ? 'admin-status-success'
              : '',

            messageType ===
            'error'
              ? 'admin-status-error'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {message}
        </div>
      )}

      <section
        className="panel"
        style={{
          marginTop: '18px',
        }}
      >
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Konzistence čistého jmění
            </h2>

            <div className="panel-subtitle">
              Kontrola živé hodnoty
              pozic proti dnešnímu
              uloženému snapshotu
            </div>
          </div>

          {!loadingNetWorthCheck &&
            netWorthCheck && (
              <ConsistencyStatus
                check={
                  netWorthCheck
                }
              />
            )}
        </div>

        <div className="panel-body">
          {loadingNetWorthCheck ? (
            <div className="loading-box">
              Kontroluji konzistenci...
            </div>
          ) : netWorthCheckError ? (
            <div className="error-box">
              {netWorthCheckError}
            </div>
          ) : netWorthCheck ? (
            <>
              <div
                style={{
                  display: 'grid',

                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(180px, 1fr))',

                  gap: '14px',
                }}
              >
                <ConsistencyMetric
                  label="Live net worth"
                  value={formatMoney(
                    netWorthCheck.liveNetWorth
                  )}
                  detail="Součet positions.current_value"
                />

                <ConsistencyMetric
                  label="Dnešní snapshot"
                  value={
                    netWorthCheck.snapshotNetWorth !==
                    null
                      ? formatMoney(
                          netWorthCheck.snapshotNetWorth
                        )
                      : 'Chybí'
                  }
                  detail={
                    netWorthCheck.hasTodaySnapshot
                      ? formatDate(
                          netWorthCheck.snapshotDate
                        )
                      : netWorthCheck.snapshotDate
                        ? `Poslední uložený: ${formatDate(
                            netWorthCheck.snapshotDate
                          )}`
                        : 'Žádný snapshot'
                  }
                />

                <ConsistencyMetric
                  label="Rozdíl"
                  value={
                    netWorthCheck.difference !==
                    null
                      ? formatMoney(
                          netWorthCheck.difference
                        )
                      : '—'
                  }
                  tone={
                    netWorthCheck.difference !==
                      null &&
                    Math.abs(
                      netWorthCheck.difference
                    ) >= 0.01
                      ? 'warning'
                      : 'default'
                  }
                />

                <ConsistencyMetric
                  label="Rozdíl v %"
                  value={
                    netWorthCheck.differencePercent !==
                    null
                      ? formatPercent(
                          netWorthCheck.differencePercent
                        )
                      : '—'
                  }
                  tone={
                    netWorthCheck.difference !==
                      null &&
                    Math.abs(
                      netWorthCheck.difference
                    ) >= 0.01
                      ? 'warning'
                      : 'default'
                  }
                />
              </div>

              <div
                style={{
                  display: 'flex',

                  justifyContent:
                    'space-between',

                  alignItems:
                    'center',

                  gap: '16px',

                  marginTop:
                    '20px',

                  paddingTop:
                    '18px',

                  borderTop:
                    '1px solid var(--border)',

                  flexWrap:
                    'wrap',
                }}
              >
                <div
                  style={{
                    color:
                      'var(--text-secondary)',

                    fontSize:
                      '12px',

                    lineHeight:
                      1.5,
                  }}
                >
                  {!netWorthCheck.hasTodaySnapshot
                    ? 'Dnešní snapshot zatím neexistuje.'
                    : netWorthCheck.matches
                      ? 'Živá hodnota a dnešní snapshot jsou v souladu.'
                      : 'Živá hodnota se liší od dnešního snapshotu.'}
                </div>

                <button
                  className={
                    netWorthCheck.matches
                      ? 'button-secondary'
                      : 'button-primary'
                  }
                  onClick={
                    handleUpdateTodaySnapshot
                  }
                  disabled={
                    busy
                  }
                >
                  {runningOperation ===
                  'snapshot'
                    ? 'Aktualizuji...'
                    : netWorthCheck.hasTodaySnapshot
                      ? 'Aktualizovat dnešní snapshot'
                      : 'Vytvořit dnešní snapshot'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section
        className="panel"
        style={{
          marginTop: '18px',
        }}
      >
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Obsah standardní zálohy
            </h2>

            <div className="panel-subtitle">
              Data, která nelze nebo
              nechceme rekonstruovat
              z externích zdrojů
            </div>
          </div>
        </div>

        <div className="panel-body">
          <div className="admin-data-list">
            <DataSourceRow
              name="Instrumenty"
              table="instruments"
              description="Definice aktiv, tickerů a způsobu ocenění"
            />

            <DataSourceRow
              name="Pozice"
              table="positions"
              description="Množství, pořizovací náklady a aktuální hodnota"
            />

            <DataSourceRow
              name="Cashflow"
              table="cashflows"
              description="Transakce, příjmy a externí cashflow"
            />

            <DataSourceRow
              name="Historie majetku"
              table="portfolio_snapshots"
              description="Historické hodnoty čistého jmění"
            />

            <DataSourceRow
              name="FIRE nastavení"
              table="fire_settings"
              description="Parametry akumulace a rentové simulace"
            />

            <DataSourceRow
              name="FX historie"
              table="fx_history"
              description="Uložené měnové kurzy"
            />

            <DataSourceRow
              name="Synchronizace"
              table="app_sync_status"
              description="Stav automatických aktualizací"
            />

            <DataSourceRow
              name="Historie cen"
              table="price_history"
              description="Volitelná součást zálohy"
              optional
            />
          </div>
        </div>
      </section>

      <div className="admin-footer-note">
        Záloha obsahuje finanční
        informace. Ukládej exportovaný
        JSON pouze do důvěryhodného
        úložiště. Soubor není šifrovaný.
      </div>
    </div>
  )
}

function ConsistencyStatus({
  check,
}: {
  check: NetWorthCheck
}) {
  let label =
    'Shoda'

  let color =
    '#416653'

  let background =
    '#edf5f0'

  let border =
    '#d5e7dc'

  if (
    !check.hasTodaySnapshot
  ) {
    label =
      'Snapshot chybí'

    color =
      '#84611f'

    background =
      '#fff7df'

    border =
      '#ead9a4'
  } else if (
    !check.matches
  ) {
    label =
      'Neshoda'

    color =
      '#8b4444'

    background =
      'var(--danger-soft)'

    border =
      '#ead8d8'
  }

  return (
    <span
      style={{
        display:
          'inline-flex',

        alignItems:
          'center',

        padding:
          '5px 10px',

        color,

        background,

        border:
          `1px solid ${border}`,

        borderRadius:
          '999px',

        fontSize:
          '11px',

        fontWeight:
          600,
      }}
    >
      {label}
    </span>
  )
}

function ConsistencyMetric({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: string
  detail?: string

  tone?:
    | 'default'
    | 'warning'
}) {
  return (
    <div
      style={{
        padding:
          '14px 16px',

        background:
          tone === 'warning'
            ? '#fffaf0'
            : '#fafbfc',

        border:
          `1px solid ${
            tone === 'warning'
              ? '#ead9a4'
              : 'var(--border)'
          }`,

        borderRadius:
          '6px',
      }}
    >
      <div
        style={{
          color:
            'var(--text-muted)',

          fontSize:
            '11px',

          fontWeight:
            600,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            '5px',

          color:
            tone === 'warning'
              ? '#84611f'
              : 'var(--text)',

          fontSize:
            '18px',

          fontWeight:
            600,

          fontVariantNumeric:
            'tabular-nums',
        }}
      >
        {value}
      </div>

      {detail && (
        <div
          style={{
            marginTop:
              '4px',

            color:
              'var(--text-muted)',

            fontSize:
              '10px',
          }}
        >
          {detail}
        </div>
      )}
    </div>
  )
}

function DataOperation({
  title,
  description,
  detail,
  children,
}: {
  title: string
  description: ReactNode
  detail: string
  children: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">
            {title}
          </h2>
        </div>
      </div>

      <div className="panel-body admin-operation-body">
        <div className="admin-operation-description">
          {description}
        </div>

        <div className="admin-operation-detail">
          {detail}
        </div>

        <div className="admin-operation-action">
          {children}
        </div>
      </div>
    </section>
  )
}

function DataSourceRow({
  name,
  table,
  description,
  optional = false,
}: {
  name: string
  table: string
  description: string
  optional?: boolean
}) {
  return (
    <div className="admin-data-row">
      <div>
        <div className="admin-data-name">
          {name}

          {optional && (
            <span className="admin-optional">
              volitelné
            </span>
          )}
        </div>

        <div className="admin-data-description">
          {description}
        </div>
      </div>

      <div className="admin-table-name">
        {table}
      </div>
    </div>
  )
}