import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  createExternalCashflow,
  deleteCashflow,
  getCashflows,
  type ExternalCashflowType,
} from '../services/cashflowManager'

type CashflowRow = {
  id: string

  transaction_date: string
  transaction_type: string

  amount_czk:
    | number
    | string

  is_external: boolean

  note:
    | string
    | null

  instruments:
    | {
        name: string
      }
    | null
}

type FilterType =
  | 'ALL'
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'COUPON'
  | 'CONTRIBUTION'
  | 'WITHDRAWAL'

function today() {
  return new Date()
    .toISOString()
    .slice(0, 10)
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

function formatCompactMoney(
  value: number
) {
  if (
    Math.abs(value) >=
    1_000_000
  ) {
    return `${(
      value / 1_000_000
    ).toLocaleString(
      'cs-CZ',
      {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      }
    )} mil. Kč`
  }

  if (
    Math.abs(value) >=
    1_000
  ) {
    return `${(
      value / 1_000
    ).toLocaleString(
      'cs-CZ',
      {
        maximumFractionDigits: 0,
      }
    )} tis. Kč`
  }

  return formatMoney(value)
}

function formatDate(
  value: string
) {
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

function transactionName(
  type: string
) {
  switch (type) {
    case 'BUY':
      return 'Nákup'

    case 'SELL':
      return 'Prodej'

    case 'DIVIDEND':
      return 'Dividenda'

    case 'COUPON':
      return 'Kupón'

    case 'CONTRIBUTION':
      return 'Vklad'

    case 'WITHDRAWAL':
      return 'Výběr'

    case 'FEE':
      return 'Poplatek'

    case 'TAX':
      return 'Daň'

    case 'INTEREST':
      return 'Úrok'

    default:
      return type
  }
}

function transactionBadgeClass(
  type: string
) {
  switch (type) {
    case 'DIVIDEND':
    case 'COUPON':
    case 'INTEREST':
      return 'cashflow-badge cashflow-badge-income'

    case 'CONTRIBUTION':
      return 'cashflow-badge cashflow-badge-contribution'

    case 'WITHDRAWAL':
      return 'cashflow-badge cashflow-badge-withdrawal'

    default:
      return 'cashflow-badge'
  }
}

export default function Cashflow() {
  const [
    cashflows,
    setCashflows,
  ] =
    useState<
      CashflowRow[]
    >([])

  const [date, setDate] =
    useState(today())

  const [type, setType] =
    useState<ExternalCashflowType>(
      'CONTRIBUTION'
    )

  const [
    amount,
    setAmount,
  ] = useState('')

  const [note, setNote] =
    useState('')

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    filterType,
    setFilterType,
  ] =
    useState<FilterType>(
      'ALL'
    )

  const [
    onlyExternal,
    setOnlyExternal,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  async function load() {
    try {
      setLoading(true)
      setErrorMessage('')

      const data =
        await getCashflows()

      setCashflows(
        data as CashflowRow[]
      )
    } catch (error) {
      console.error(
        'Cashflow:',
        error
      )

      setErrorMessage(
        'Cashflow se nepodařilo načíst.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSave() {
    const numericAmount =
      Number(
        amount
          .replace(/\s/g, '')
          .replace(',', '.')
      )

    if (
      !date ||
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setMessage(
        'Zadej platné datum a kladnou částku.'
      )

      return
    }

    try {
      setSaving(true)
      setMessage('')

      await createExternalCashflow(
        date,
        type,
        numericAmount,
        note
      )

      setAmount('')
      setNote('')

      setMessage(
        type ===
          'CONTRIBUTION'
          ? 'Vklad byl uložen.'
          : 'Výběr byl uložen.'
      )

      await load()
    } catch (error) {
      console.error(
        'Cashflow save:',
        error
      )

      setMessage(
        'Cashflow se nepodařilo uložit.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(
    row: CashflowRow
  ) {
    if (!row.is_external) {
      return
    }

    const confirmed =
      window.confirm(
        'Opravdu smazat tento externí pohyb?'
      )

    if (!confirmed) {
      return
    }

    try {
      await deleteCashflow(
        row.id
      )

      setMessage(
        'Externí cashflow bylo smazáno.'
      )

      await load()
    } catch (error) {
      console.error(
        'Cashflow delete:',
        error
      )

      setMessage(
        'Cashflow se nepodařilo smazat.'
      )
    }
  }

  const stats =
    useMemo(() => {
      let contributions = 0
      let withdrawals = 0
      let dividends = 0
      let coupons = 0

      for (
        const row of
        cashflows
      ) {
        const value =
          Number(
            row.amount_czk
          )

        if (
          row.is_external &&
          row.transaction_type ===
            'CONTRIBUTION'
        ) {
          contributions +=
            Math.abs(value)
        }

        if (
          row.is_external &&
          row.transaction_type ===
            'WITHDRAWAL'
        ) {
          withdrawals +=
            Math.abs(value)
        }

        if (
          row.transaction_type ===
          'DIVIDEND'
        ) {
          dividends +=
            value
        }

        if (
          row.transaction_type ===
          'COUPON'
        ) {
          coupons += value
        }
      }

      return {
        contributions,

        withdrawals,

        netExternal:
          contributions -
          withdrawals,

        passiveIncome:
          dividends +
          coupons,
      }
    }, [cashflows])

  const visibleCashflows =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      return cashflows.filter(
        (row) => {
          if (
            onlyExternal &&
            !row.is_external
          ) {
            return false
          }

          if (
            filterType !==
              'ALL' &&
            row.transaction_type !==
              filterType
          ) {
            return false
          }

          if (!query) {
            return true
          }

          const instrument =
            row.instruments
              ?.name ??
            ''

          const typeName =
            transactionName(
              row.transaction_type
            )

          const noteValue =
            row.note ??
            ''

          return (
            instrument
              .toLowerCase()
              .includes(query) ||
            typeName
              .toLowerCase()
              .includes(query) ||
            noteValue
              .toLowerCase()
              .includes(query)
          )
        }
      )
    }, [
      cashflows,
      onlyExternal,
      filterType,
      search,
    ])

  if (loading) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám cashflow...
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="page">
        <div className="error-box">
          {errorMessage}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            Cashflow
          </h1>

          <p className="page-subtitle">
            Transakční historie,
            dividendy, kupóny a
            externí vklady či výběry.
          </p>
        </div>

        <div
          style={{
            color:
              'var(--text-muted)',

            fontSize:
              '12px',

            textAlign:
              'right',

            lineHeight:
              1.6,
          }}
        >
          {cashflows.length.toLocaleString(
            'cs-CZ'
          )}
          {' '}
          transakcí
        </div>
      </header>

      <section className="kpi-grid">
        <MetricCard
          label="Externí vklady"
          value={formatCompactMoney(
            stats.contributions
          )}
          description={formatMoney(
            stats.contributions
          )}
        />

        <MetricCard
          label="Externí výběry"
          value={formatCompactMoney(
            stats.withdrawals
          )}
          description={formatMoney(
            stats.withdrawals
          )}
        />

        <MetricCard
          label="Čisté externí vklady"
          value={formatCompactMoney(
            stats.netExternal
          )}
          description={formatMoney(
            stats.netExternal
          )}
        />

        <MetricCard
          label="Dividendy a kupóny"
          value={formatCompactMoney(
            stats.passiveIncome
          )}
          description={formatMoney(
            stats.passiveIncome
          )}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Externí cashflow
            </h2>

            <div className="panel-subtitle">
              Pouze skutečné nové
              peníze vložené do
              portfolia nebo výběry
              z portfolia
            </div>
          </div>
        </div>

        <div className="panel-body">
          <div className="cashflow-form-grid">
            <Field label="Datum">
              <input
                className="form-control"
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(
                    event.target
                      .value
                  )
                }
              />
            </Field>

            <Field label="Typ">
              <select
                className="form-control"
                value={type}
                onChange={(event) =>
                  setType(
                    event.target
                      .value as ExternalCashflowType
                  )
                }
              >
                <option value="CONTRIBUTION">
                  Vklad
                </option>

                <option value="WITHDRAWAL">
                  Výběr
                </option>
              </select>
            </Field>

            <Field label="Částka CZK">
              <input
                className="form-control"
                value={amount}
                onChange={(event) =>
                  setAmount(
                    event.target
                      .value
                  )
                }
                inputMode="decimal"
                placeholder="80 000"
              />
            </Field>

            <Field label="Poznámka">
              <input
                className="form-control"
                value={note}
                onChange={(event) =>
                  setNote(
                    event.target
                      .value
                  )
                }
                placeholder="Měsíční investice"
              />
            </Field>

            <div className="cashflow-save-cell">
              <button
                className="button-primary"
                onClick={
                  handleSave
                }
                disabled={saving}
              >
                {saving
                  ? 'Ukládám...'
                  : type ===
                      'CONTRIBUTION'
                    ? 'Přidat vklad'
                    : 'Přidat výběr'}
              </button>
            </div>
          </div>

          {message && (
            <div className="cashflow-status">
              {message}
            </div>
          )}
        </div>
      </section>

      <section
        className="panel"
        style={{
          marginTop: '18px',
        }}
      >
        <div className="panel-header cashflow-table-header">
          <div>
            <h2 className="panel-title">
              Historie
            </h2>

            <div className="panel-subtitle">
              Všechny peněžní pohyby
              portfolia
            </div>
          </div>

          <div className="cashflow-filters">
            <input
              className="form-control cashflow-search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Hledat..."
            />

            <select
              className="form-control cashflow-filter-select"
              value={filterType}
              onChange={(event) =>
                setFilterType(
                  event.target
                    .value as FilterType
                )
              }
            >
              <option value="ALL">
                Všechny typy
              </option>

              <option value="BUY">
                Nákupy
              </option>

              <option value="SELL">
                Prodeje
              </option>

              <option value="DIVIDEND">
                Dividendy
              </option>

              <option value="COUPON">
                Kupóny
              </option>

              <option value="CONTRIBUTION">
                Vklady
              </option>

              <option value="WITHDRAWAL">
                Výběry
              </option>
            </select>

            <label className="cashflow-external-filter">
              <input
                type="checkbox"
                checked={
                  onlyExternal
                }
                onChange={(event) =>
                  setOnlyExternal(
                    event.target
                      .checked
                  )
                }
              />

              Jen externí
            </label>
          </div>
        </div>

        {visibleCashflows.length >
        0 ? (
          <div
            style={{
              overflowX:
                'auto',
            }}
          >
            <table className="financial-table">
              <thead>
                <tr>
                  <th className="cell-date">
                    Datum
                  </th>

                  <th className="cell-text">
                    Typ
                  </th>

                  <th className="cell-text">
                    Instrument
                  </th>

                  <th className="cell-number">
                    Částka
                  </th>

                  <th className="cell-text">
                    Charakter
                  </th>

                  <th className="cell-text">
                    Poznámka
                  </th>

                  <th
                    style={{
                      width:
                        '52px',
                    }}
                  />
                </tr>
              </thead>

              <tbody>
                {visibleCashflows.map(
                  (row) => {
                    const value =
                      Number(
                        row.amount_czk
                      )

                    const isIncome =
                      row.transaction_type ===
                        'DIVIDEND' ||
                      row.transaction_type ===
                        'COUPON' ||
                      row.transaction_type ===
                        'INTEREST'

                    const isWithdrawal =
                      row.transaction_type ===
                      'WITHDRAWAL'

                    const amountClass =
                      isWithdrawal ||
                      value < 0
                        ? 'cell-number cell-negative'
                        : isIncome
                          ? 'cell-number cell-positive'
                          : 'cell-number'

                    return (
                      <tr
                        key={
                          row.id
                        }
                      >
                        <td className="cell-date">
                          {formatDate(
                            row.transaction_date
                          )}
                        </td>

                        <td className="cell-text">
                          <span
                            className={
                              transactionBadgeClass(
                                row.transaction_type
                              )
                            }
                          >
                            {transactionName(
                              row.transaction_type
                            )}
                          </span>
                        </td>

                        <td className="cell-text">
                          <span className="instrument-name">
                            {row
                              .instruments
                              ?.name ??
                              '—'}
                          </span>
                        </td>

                        <td className={amountClass}>
                          {formatMoney(
                            value
                          )}
                        </td>

                        <td className="cell-text">
                          {row.is_external ? (
                            <span className="cashflow-external-label">
                              Externí
                            </span>
                          ) : (
                            <span className="cell-muted">
                              Interní
                            </span>
                          )}
                        </td>

                        <td className="cell-text">
                          <span
                            style={{
                              color:
                                'var(--text-secondary)',
                            }}
                          >
                            {row.note ||
                              '—'}
                          </span>
                        </td>

                        <td className="cell-number">
                          {row.is_external && (
                            <button
                              className="cashflow-delete"
                              onClick={() =>
                                handleDelete(
                                  row
                                )
                              }
                              title="Smazat externí cashflow"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            className="empty-box"
            style={{
              margin: '20px',
            }}
          >
            Filtru neodpovídají
            žádné transakce.
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {label}
      </div>

      <div className="kpi-value">
        {value}
      </div>

      {description && (
        <div className="kpi-description">
          {description}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="form-label">
        {label}
      </label>

      {children}
    </div>
  )
}