import {
  useState,
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

type Operation =
  | 'history'
  | 'cashflow'
  | 'backup'
  | null

type MessageType =
  | 'info'
  | 'success'
  | 'error'

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

  const busy =
    runningOperation !==
    null

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

function DataOperation({
  title,
  description,
  detail,
  children,
}: {
  title: string
  description:
    React.ReactNode
  detail: string
  children:
    React.ReactNode
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