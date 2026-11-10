import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  createPosition,
  deletePosition,
  getInstrumentsForPosition,
  getPositions,
  updatePosition,
} from '../services/positionManager'

type Instrument = {
  id: string
  name: string
}

type Position = {
  id: string
  instrument_id: string

  quantity:
    | number
    | string

  total_cost:
    | number
    | string

  current_value:
    | number
    | string

  instruments:
    | {
        name: string
      }
    | null
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

function formatNumber(
  value: number
) {
  return value.toLocaleString(
    'cs-CZ',
    {
      maximumFractionDigits: 6,
    }
  )
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
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )} %`
}

function parseNumericInput(
  value: string
) {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.')

  const result =
    Number(normalized)

  return Number.isFinite(result)
    ? result
    : null
}

export default function PositionManager() {
  const [
    positions,
    setPositions,
  ] = useState<Position[]>([])

  const [
    instruments,
    setInstruments,
  ] = useState<Instrument[]>([])

  const [
    editingId,
    setEditingId,
  ] =
    useState<string | null>(
      null
    )

  const [
    instrumentId,
    setInstrumentId,
  ] = useState('')

  const [
    quantity,
    setQuantity,
  ] = useState('')

  const [
    cost,
    setCost,
  ] = useState('')

  const [
    value,
    setValue,
  ] = useState('')

  const [
    search,
    setSearch,
  ] = useState('')

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

      const [
        positionData,
        instrumentData,
      ] = await Promise.all([
        getPositions(),
        getInstrumentsForPosition(),
      ])

      const loadedPositions =
        positionData as Position[]

      const loadedInstruments =
        instrumentData as Instrument[]

      setPositions(
        loadedPositions
      )

      setInstruments(
        loadedInstruments
      )

      setInstrumentId(
        (current) => {
          if (
            current &&
            loadedInstruments.some(
              (instrument) =>
                instrument.id ===
                current
            )
          ) {
            return current
          }

          return (
            loadedInstruments[0]
              ?.id ??
            ''
          )
        }
      )
    } catch (error) {
      console.error(
        'Position manager:',
        error
      )

      setErrorMessage(
        'Pozice se nepodařilo načíst.'
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

    setQuantity('')
    setCost('')
    setValue('')
    setMessage('')

    if (
      instruments.length > 0
    ) {
      setInstrumentId(
        instruments[0].id
      )
    }
  }

  function handleEdit(
    position: Position
  ) {
    setEditingId(
      position.id
    )

    setInstrumentId(
      position.instrument_id
    )

    setQuantity(
      String(
        position.quantity
      )
    )

    setCost(
      String(
        position.total_cost
      )
    )

    setValue(
      String(
        position.current_value
      )
    )

    setMessage('')

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function handleSave() {
    const numericQuantity =
      parseNumericInput(
        quantity
      )

    const numericCost =
      parseNumericInput(
        cost
      )

    const numericValue =
      parseNumericInput(
        value
      )

    if (!instrumentId) {
      setMessage(
        'Vyber instrument.'
      )

      return
    }

    if (
      numericQuantity ===
        null ||
      numericQuantity < 0
    ) {
      setMessage(
        'Zadej platný počet jednotek.'
      )

      return
    }

    if (
      numericCost === null ||
      numericCost < 0
    ) {
      setMessage(
        'Zadej platné pořizovací náklady.'
      )

      return
    }

    if (
      numericValue === null ||
      numericValue < 0
    ) {
      setMessage(
        'Zadej platnou aktuální hodnotu.'
      )

      return
    }

    try {
      setSaving(true)
      setMessage('')

      if (editingId) {
        await updatePosition(
          editingId,
          instrumentId,
          numericQuantity,
          numericCost,
          numericValue
        )

        setMessage(
          'Pozice byla upravena.'
        )
      } else {
        await createPosition(
          instrumentId,
          numericQuantity,
          numericCost,
          numericValue
        )

        setMessage(
          'Pozice byla vytvořena.'
        )
      }

      setEditingId(null)

      setQuantity('')
      setCost('')
      setValue('')

      await load()
    } catch (error) {
      console.error(
        'Position save:',
        error
      )

      setMessage(
        'Pozici se nepodařilo uložit.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(
    position: Position
  ) {
    const name =
      position.instruments
        ?.name ??
      'pozici'

    const confirmed =
      window.confirm(
        `Opravdu smazat pozici ${name}?`
      )

    if (!confirmed) {
      return
    }

    try {
      await deletePosition(
        position.id
      )

      if (
        editingId ===
        position.id
      ) {
        resetForm()
      }

      setMessage(
        'Pozice byla smazána.'
      )

      await load()
    } catch (error) {
      console.error(
        'Position delete:',
        error
      )

      setMessage(
        'Pozici se nepodařilo smazat.'
      )
    }
  }

  const totals =
    useMemo(() => {
      let currentValue = 0
      let totalCost = 0

      for (
        const position of
        positions
      ) {
        currentValue +=
          Number(
            position.current_value
          )

        totalCost +=
          Number(
            position.total_cost
          )
      }

      const profit =
        currentValue -
        totalCost

      const returnPercent =
        totalCost > 0
          ? (
              profit /
              totalCost
            ) * 100
          : 0

      return {
        currentValue,
        totalCost,
        profit,
        returnPercent,
      }
    }, [positions])

  const visiblePositions =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      const filtered =
        query
          ? positions.filter(
              (position) =>
                position
                  .instruments
                  ?.name
                  ?.toLowerCase()
                  .includes(
                    query
                  )
            )
          : positions

      return [
        ...filtered,
      ].sort(
        (a, b) =>
          Number(
            b.current_value
          ) -
          Number(
            a.current_value
          )
      )
    }, [
      positions,
      search,
    ])

  if (loading) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám pozice...
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
            Správa pozic
          </h1>

          <p className="page-subtitle">
            Evidence množství,
            pořizovacích nákladů a
            současné hodnoty pozic.
          </p>
        </div>

        <div className="position-header-meta">
          {positions.length.toLocaleString(
            'cs-CZ'
          )}
          {' '}
          pozic
        </div>
      </header>

      <section className="kpi-grid">
        <MetricCard
          label="Hodnota"
          value={formatMoney(
            totals.currentValue
          )}
        />

        <MetricCard
          label="Náklady"
          value={formatMoney(
            totals.totalCost
          )}
        />

        <MetricCard
          label="Výsledek"
          value={formatMoney(
            totals.profit
          )}
          tone={
            totals.profit > 0
              ? 'positive'
              : totals.profit < 0
                ? 'negative'
                : 'default'
          }
        />

        <MetricCard
          label="Výnos"
          value={formatPercent(
            totals.returnPercent
          )}
          tone={
            totals.returnPercent >
            0
              ? 'positive'
              : totals.returnPercent <
                  0
                ? 'negative'
                : 'default'
          }
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              {editingId
                ? 'Upravit pozici'
                : 'Nová pozice'}
            </h2>

            <div className="panel-subtitle">
              {editingId
                ? 'Úprava evidovaných údajů'
                : 'Přidání pozice do portfolia'}
            </div>
          </div>

          {editingId && (
            <button
              className="button-secondary"
              onClick={resetForm}
            >
              Zrušit editaci
            </button>
          )}
        </div>

        <div className="panel-body">
          <div className="position-editor-grid">
            <Field label="Instrument">
              <select
                className="form-control"
                value={
                  instrumentId
                }
                onChange={(event) =>
                  setInstrumentId(
                    event.target
                      .value
                  )
                }
              >
                {instruments.map(
                  (
                    instrument
                  ) => (
                    <option
                      key={
                        instrument.id
                      }
                      value={
                        instrument.id
                      }
                    >
                      {
                        instrument.name
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Počet">
              <input
                className="form-control position-numeric-input"
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target
                      .value
                  )
                }
                placeholder="100"
                inputMode="decimal"
              />
            </Field>

            <Field label="Náklady">
              <div className="input-with-unit">
                <input
                  className="form-control position-numeric-input"
                  value={cost}
                  onChange={(event) =>
                    setCost(
                      event.target
                        .value
                    )
                  }
                  placeholder="500 000"
                  inputMode="decimal"
                />

                <span>Kč</span>
              </div>
            </Field>

            <Field label="Aktuální hodnota">
              <div className="input-with-unit">
                <input
                  className="form-control position-numeric-input"
                  value={value}
                  onChange={(event) =>
                    setValue(
                      event.target
                        .value
                    )
                  }
                  placeholder="650 000"
                  inputMode="decimal"
                />

                <span>Kč</span>
              </div>
            </Field>
          </div>

          <div className="position-editor-footer">
            <div className="position-editor-note">
              U automaticky
              oceňovaných instrumentů
              se aktuální hodnota při
              další aktualizaci trhu
              přepočítá podle množství
              a ceny.
            </div>

            <button
              className="button-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? 'Ukládám...'
                : editingId
                  ? 'Uložit změny'
                  : 'Přidat pozici'}
            </button>
          </div>

          {message && (
            <div className="position-status">
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
              Pozice
            </h2>

            <div className="panel-subtitle">
              Seřazeno podle současné
              tržní hodnoty
            </div>
          </div>

          <div
            style={{
              width: '260px',
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

        {visiblePositions.length >
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

                  <th className="cell-number">
                    Počet
                  </th>

                  <th className="cell-number">
                    Náklady
                  </th>

                  <th className="cell-number">
                    Hodnota
                  </th>

                  <th className="cell-number">
                    Výsledek
                  </th>

                  <th className="cell-number">
                    Výnos
                  </th>

                  <th className="position-actions-column">
                    Akce
                  </th>
                </tr>
              </thead>

              <tbody>
                {visiblePositions.map(
                  (position) => {
                    const quantityValue =
                      Number(
                        position.quantity
                      )

                    const costValue =
                      Number(
                        position.total_cost
                      )

                    const currentValue =
                      Number(
                        position.current_value
                      )

                    const profit =
                      currentValue -
                      costValue

                    const returnPercent =
                      costValue > 0
                        ? (
                            profit /
                            costValue
                          ) * 100
                        : 0

                    const resultClass =
                      profit > 0
                        ? 'cell-positive'
                        : profit < 0
                          ? 'cell-negative'
                          : ''

                    return (
                      <tr
                        key={
                          position.id
                        }
                      >
                        <td className="cell-text">
                          <span className="instrument-name">
                            {position
                              .instruments
                              ?.name ??
                              'Neznámý instrument'}
                          </span>
                        </td>

                        <td className="cell-number">
                          {formatNumber(
                            quantityValue
                          )}
                        </td>

                        <td className="cell-number">
                          {formatMoney(
                            costValue
                          )}
                        </td>

                        <td className="cell-number">
                          <strong className="position-current-value">
                            {formatMoney(
                              currentValue
                            )}
                          </strong>
                        </td>

                        <td
                          className={`cell-number ${resultClass}`}
                        >
                          {formatMoney(
                            profit
                          )}
                        </td>

                        <td
                          className={`cell-number ${resultClass}`}
                        >
                          {formatPercent(
                            returnPercent
                          )}
                        </td>

                        <td className="position-actions-column">
                          <div className="position-table-actions">
                            <button
                              className="position-text-action"
                              onClick={() =>
                                handleEdit(
                                  position
                                )
                              }
                            >
                              Upravit
                            </button>

                            <button
                              className="position-text-action position-text-action-danger"
                              onClick={() =>
                                handleDelete(
                                  position
                                )
                              }
                            >
                              Smazat
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>

              <tfoot>
                <tr className="position-total-row">
                  <td
                    colSpan={2}
                  >
                    Celkem
                  </td>

                  <td className="cell-number">
                    {formatMoney(
                      totals.totalCost
                    )}
                  </td>

                  <td className="cell-number">
                    <strong>
                      {formatMoney(
                        totals.currentValue
                      )}
                    </strong>
                  </td>

                  <td
                    className={
                      totals.profit > 0
                        ? 'cell-number cell-positive'
                        : totals.profit < 0
                          ? 'cell-number cell-negative'
                          : 'cell-number'
                    }
                  >
                    {formatMoney(
                      totals.profit
                    )}
                  </td>

                  <td
                    className={
                      totals.returnPercent >
                      0
                        ? 'cell-number cell-positive'
                        : totals.returnPercent <
                            0
                          ? 'cell-number cell-negative'
                          : 'cell-number'
                    }
                  >
                    {formatPercent(
                      totals.returnPercent
                    )}
                  </td>

                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div
            className="empty-box"
            style={{
              margin: '20px',
            }}
          >
            {search
              ? 'Vyhledávání neodpovídá žádné pozici.'
              : 'Nejsou evidovány žádné pozice.'}
          </div>
        )}
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string

  tone?:
    | 'default'
    | 'positive'
    | 'negative'
}) {
  const valueClass =
    tone === 'positive'
      ? 'positive'
      : tone === 'negative'
        ? 'negative'
        : ''

  return (
    <div className="kpi-card">
      <div className="kpi-label">
        {label}
      </div>

      <div
        className={`kpi-value ${valueClass}`}
      >
        {value}
      </div>
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