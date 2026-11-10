import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  createInstrument,
  deleteInstrument,
  getInstruments,
  updateInstrument,
  type PricingSource,
  type ValuationMode,
} from '../services/instrumentManager'

type Instrument = {
  id: string
  name: string

  ticker:
    | string
    | null

  asset_type: string
  currency: string

  pricing_source:
    | PricingSource
    | null

  valuation_mode:
    | ValuationMode
    | null
}

function pricingSourceName(
  value:
    | PricingSource
    | null
) {
  return value === 'yahoo'
    ? 'Yahoo Finance'
    : 'Ruční'
}

function valuationModeName(
  value:
    | ValuationMode
    | null
) {
  return value ===
    'total_value'
    ? 'Celková hodnota'
    : 'Cena za jednotku'
}

export default function InstrumentManager() {
  const [
    instruments,
    setInstruments,
  ] =
    useState<Instrument[]>([])

  const [
    editingId,
    setEditingId,
  ] =
    useState<string | null>(
      null
    )

  const [
    search,
    setSearch,
  ] =
    useState('')

  const [name, setName] =
    useState('')

  const [
    ticker,
    setTicker,
  ] =
    useState('')

  const [
    assetType,
    setAssetType,
  ] =
    useState('Akcie')

  const [
    currency,
    setCurrency,
  ] =
    useState('CZK')

  const [
    pricingSource,
    setPricingSource,
  ] =
    useState<PricingSource>(
      'manual'
    )

  const [
    valuationMode,
    setValuationMode,
  ] =
    useState<ValuationMode>(
      'unit_price'
    )

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    saving,
    setSaving,
  ] =
    useState(false)

  const [
    message,
    setMessage,
  ] =
    useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('')

  async function load() {
    try {
      setLoading(true)
      setErrorMessage('')

      const data =
        await getInstruments()

      setInstruments(
        data as Instrument[]
      )
    } catch (error) {
      console.error(
        'Instrument manager:',
        error
      )

      setErrorMessage(
        'Instrumenty se nepodařilo načíst.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setEditingId(null)

    setName('')
    setTicker('')
    setAssetType('Akcie')
    setCurrency('CZK')

    setPricingSource(
      'manual'
    )

    setValuationMode(
      'unit_price'
    )

    setMessage('')
  }

  function handleEdit(
    instrument: Instrument
  ) {
    setEditingId(
      instrument.id
    )

    setName(
      instrument.name
    )

    setTicker(
      instrument.ticker ??
        ''
    )

    setAssetType(
      instrument.asset_type
    )

    setCurrency(
      instrument.currency ??
        'CZK'
    )

    setPricingSource(
      instrument
        .pricing_source ===
        'yahoo'
        ? 'yahoo'
        : 'manual'
    )

    setValuationMode(
      instrument
        .valuation_mode ===
        'total_value'
        ? 'total_value'
        : 'unit_price'
    )

    setMessage('')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function handleSave() {
    if (
      name.trim() === ''
    ) {
      setMessage(
        'Zadej název instrumentu.'
      )

      return
    }

    if (
      pricingSource ===
        'yahoo' &&
      ticker.trim() === ''
    ) {
      setMessage(
        'Pro Yahoo Finance musí být vyplněný ticker.'
      )

      return
    }

    try {
      setSaving(true)
      setMessage('')

      if (editingId) {
        await updateInstrument(
          editingId,
          name,
          ticker,
          assetType,
          currency,
          pricingSource,
          valuationMode
        )

        setMessage(
          'Instrument byl upraven.'
        )
      } else {
        await createInstrument(
          name,
          ticker,
          assetType,
          currency,
          pricingSource,
          valuationMode
        )

        setMessage(
          'Instrument byl vytvořen.'
        )
      }

      resetForm()

      await load()
    } catch (error) {
      console.error(
        'Instrument save:',
        error
      )

      setMessage(
        'Instrument se nepodařilo uložit.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(
    instrument: Instrument
  ) {
    const confirmed =
      window.confirm(
        `Opravdu smazat instrument ${instrument.name}?`
      )

    if (!confirmed) {
      return
    }

    try {
      await deleteInstrument(
        instrument.id
      )

      if (
        editingId ===
        instrument.id
      ) {
        resetForm()
      }

      setMessage(
        'Instrument byl smazán.'
      )

      await load()
    } catch (error) {
      console.error(
        'Instrument delete:',
        error
      )

      setMessage(
        'Instrument nelze smazat. Může mít navázané pozice, cashflow nebo cenovou historii.'
      )
    }
  }

  const stats =
    useMemo(() => {
      let yahoo = 0
      let manual = 0
      let unitPrice = 0
      let totalValue = 0

      for (
        const instrument of
        instruments
      ) {
        if (
          instrument
            .pricing_source ===
          'yahoo'
        ) {
          yahoo++
        } else {
          manual++
        }

        if (
          instrument
            .valuation_mode ===
          'total_value'
        ) {
          totalValue++
        } else {
          unitPrice++
        }
      }

      return {
        yahoo,
        manual,
        unitPrice,
        totalValue,
      }
    }, [instruments])

  const visibleInstruments =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      const filtered =
        !query
          ? instruments
          : instruments.filter(
              (instrument) =>
                instrument.name
                  .toLowerCase()
                  .includes(
                    query
                  ) ||
                (
                  instrument.ticker ??
                  ''
                )
                  .toLowerCase()
                  .includes(
                    query
                  ) ||
                instrument
                  .asset_type
                  .toLowerCase()
                  .includes(
                    query
                  )
            )

      return [
        ...filtered,
      ].sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            'cs'
          )
      )
    }, [
      instruments,
      search,
    ])

  if (loading) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám instrumenty...
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
            Správa instrumentů
          </h1>

          <p className="page-subtitle">
            Definice obchodovaných,
            manuálně oceňovaných a
            neveřejných aktiv.
          </p>
        </div>

        <div className="instrument-header-meta">
          {instruments.length.toLocaleString(
            'cs-CZ'
          )}
          {' '}
          instrumentů
        </div>
      </header>

      <section className="kpi-grid">
        <MetricCard
          label="Instrumenty"
          value={instruments.length.toLocaleString(
            'cs-CZ'
          )}
          description="Celkem v evidenci"
        />

        <MetricCard
          label="Yahoo Finance"
          value={stats.yahoo.toLocaleString(
            'cs-CZ'
          )}
          description="Automatické ocenění"
        />

        <MetricCard
          label="Ruční ocenění"
          value={stats.manual.toLocaleString(
            'cs-CZ'
          )}
          description="NAV nebo ruční hodnota"
        />

        <MetricCard
          label="Jednotková cena"
          value={stats.unitPrice.toLocaleString(
            'cs-CZ'
          )}
          description={`${stats.totalValue} × celková hodnota`}
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              {editingId
                ? 'Upravit instrument'
                : 'Nový instrument'}
            </h2>

            <div className="panel-subtitle">
              {editingId
                ? 'Úprava základních parametrů instrumentu'
                : 'Přidání nového instrumentu do evidence'}
            </div>
          </div>

          {editingId && (
            <button
              className="button-secondary"
              onClick={
                resetForm
              }
            >
              Zrušit editaci
            </button>
          )}
        </div>

        <div className="panel-body">
          <div className="instrument-editor-grid">
            <Field label="Název">
              <input
                className="form-control"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target
                      .value
                  )
                }
                placeholder="J&T ARCH"
              />
            </Field>

            <Field label="Ticker">
              <input
                className="form-control instrument-ticker-input"
                value={ticker}
                onChange={(event) =>
                  setTicker(
                    event.target
                      .value
                  )
                }
                placeholder="MSFT nebo prázdné"
              />
            </Field>

            <Field label="Typ aktiva">
              <input
                className="form-control"
                value={assetType}
                onChange={(event) =>
                  setAssetType(
                    event.target
                      .value
                  )
                }
                placeholder="Akcie"
              />
            </Field>

            <Field label="Měna">
              <select
                className="form-control"
                value={currency}
                onChange={(event) =>
                  setCurrency(
                    event.target
                      .value
                  )
                }
              >
                <option value="CZK">
                  CZK
                </option>

                <option value="EUR">
                  EUR
                </option>

                <option value="USD">
                  USD
                </option>
              </select>
            </Field>

            <Field label="Zdroj ceny">
              <select
                className="form-control"
                value={
                  pricingSource
                }
                onChange={(event) =>
                  setPricingSource(
                    event.target
                      .value as PricingSource
                  )
                }
              >
                <option value="yahoo">
                  Yahoo Finance
                </option>

                <option value="manual">
                  Ruční ocenění
                </option>
              </select>
            </Field>

            <Field label="Režim ocenění">
              <select
                className="form-control"
                value={
                  valuationMode
                }
                onChange={(event) =>
                  setValuationMode(
                    event.target
                      .value as ValuationMode
                  )
                }
              >
                <option value="unit_price">
                  Cena za jednotku
                </option>

                <option value="total_value">
                  Celková hodnota pozice
                </option>
              </select>
            </Field>
          </div>

          <div className="instrument-editor-footer">
            <div className="instrument-editor-note">
              Yahoo Finance vyžaduje
              platný ticker. Ruční
              instrumenty mohou používat
              jednotkovou cenu/NAV nebo
              přímou celkovou hodnotu
              pozice.
            </div>

            <button
              className="button-primary"
              onClick={
                handleSave
              }
              disabled={saving}
            >
              {saving
                ? 'Ukládám...'
                : editingId
                  ? 'Uložit změny'
                  : 'Přidat instrument'}
            </button>
          </div>

          {message && (
            <div className="instrument-status">
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
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Instrumenty
            </h2>

            <div className="panel-subtitle">
              Zdroje cen a způsob
              oceňování
            </div>
          </div>

          <div
            style={{
              width: '280px',
              maxWidth: '100%',
            }}
          >
            <input
              className="form-control"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Hledat instrument..."
            />
          </div>
        </div>

        {visibleInstruments.length >
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
                  <th className="cell-text">
                    Instrument
                  </th>

                  <th className="cell-text">
                    Ticker
                  </th>

                  <th className="cell-text">
                    Typ
                  </th>

                  <th className="cell-text">
                    Měna
                  </th>

                  <th className="cell-text">
                    Zdroj ceny
                  </th>

                  <th className="cell-text">
                    Režim
                  </th>

                  <th className="instrument-actions-column">
                    Akce
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleInstruments.map(
                  (
                    instrument
                  ) => (
                    <tr
                      key={
                        instrument.id
                      }
                    >
                      <td className="cell-text">
                        <span className="instrument-name">
                          {
                            instrument.name
                          }
                        </span>
                      </td>

                      <td className="cell-text">
                        <span className="instrument-ticker">
                          {instrument.ticker ??
                            '—'}
                        </span>
                      </td>

                      <td className="cell-text">
                        <span className="cell-muted">
                          {
                            instrument.asset_type
                          }
                        </span>
                      </td>

                      <td className="cell-text">
                        <span className="instrument-currency">
                          {
                            instrument.currency
                          }
                        </span>
                      </td>

                      <td className="cell-text">
                        <span className="badge badge-gray">
                          {pricingSourceName(
                            instrument
                              .pricing_source
                          )}
                        </span>
                      </td>

                      <td className="cell-text">
                        <span className="cell-muted">
                          {valuationModeName(
                            instrument
                              .valuation_mode
                          )}
                        </span>
                      </td>

                      <td className="instrument-actions-column">
                        <div className="instrument-table-actions">
                          <button
                            className="instrument-text-action"
                            onClick={() =>
                              handleEdit(
                                instrument
                              )
                            }
                          >
                            Upravit
                          </button>

                          <button
                            className="instrument-text-action instrument-text-action-danger"
                            onClick={() =>
                              handleDelete(
                                instrument
                              )
                            }
                          >
                            Smazat
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
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
            Vyhledávání
            neodpovídá žádnému
            instrumentu.
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