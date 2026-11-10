import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  getPortfolioPositions,
  type PortfolioPosition,
} from '../services/portfolio'

import InstrumentDetail from './InstrumentDetail'

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
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )} %`
}

function formatWeight(
  value: number
) {
  return `${value.toLocaleString(
    'cs-CZ',
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  )} %`
}

function formatQuantity(
  value: number
) {
  return value.toLocaleString(
    'cs-CZ',
    {
      maximumFractionDigits: 6,
    }
  )
}

export default function Portfolio() {
  const [
    positions,
    setPositions,
  ] =
    useState<
      PortfolioPosition[]
    >([])

  const [
    selectedPosition,
    setSelectedPosition,
  ] =
    useState<
      PortfolioPosition | null
    >(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    search,
    setSearch,
  ] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setErrorMessage('')

        const data =
          await getPortfolioPositions()

        if (!cancelled) {
          setPositions(data)
        }
      } catch (error) {
        console.error(
          'Portfolio:',
          error
        )

        if (!cancelled) {
          setErrorMessage(
            'Portfolio se nepodařilo načíst.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const totals =
    useMemo(() => {
      let value = 0
      let cost = 0

      for (
        const position of
        positions
      ) {
        value +=
          position.current_value

        cost +=
          position.total_cost
      }

      const profit =
        value - cost

      const returnPercent =
        cost > 0
          ? (
              profit /
              cost
            ) * 100
          : 0

      return {
        value,
        cost,
        profit,
        returnPercent,
      }
    }, [positions])

  const filteredPositions =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      if (!query) {
        return positions
      }

      return positions.filter(
        (position) => {
          const instrument =
            position.instruments

          return (
            instrument?.name
              .toLowerCase()
              .includes(query) ||
            instrument?.ticker
              ?.toLowerCase()
              .includes(query) ||
            instrument?.asset_type
              ?.toLowerCase()
              .includes(query)
          )
        }
      )
    }, [
      positions,
      search,
    ])

  /*
   * Service už pozice řadí,
   * ale řazení necháváme explicitní
   * i zde pro filtrování.
   */
  const sortedPositions =
    useMemo(
      () =>
        [
          ...filteredPositions,
        ].sort(
          (a, b) =>
            b.current_value -
            a.current_value
        ),
      [filteredPositions]
    )

  if (loading) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám portfolio...
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
            Portfolio
          </h1>

          <p className="page-subtitle">
            Současné pozice,
            pořizovací náklady a
            tržní přecenění v korunách.
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
          {positions.length.toLocaleString(
            'cs-CZ'
          )}
          {' '}
          pozic
        </div>
      </header>

      <section className="kpi-grid">
        <MetricCard
          label="Hodnota portfolia"
          value={formatMoney(
            totals.value
          )}
        />

        <MetricCard
          label="Investovaný kapitál"
          value={formatMoney(
            totals.cost
          )}
        />

        <MetricCard
          label="Nerealizovaný výsledek"
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
            totals.returnPercent > 0
              ? 'positive'
              : totals.returnPercent < 0
                ? 'negative'
                : 'default'
          }
        />
      </section>

      {selectedPosition && (
        <div
          style={{
            marginBottom:
              '20px',
          }}
        >
          <InstrumentDetail
            position={
              selectedPosition
            }
            onClose={() =>
              setSelectedPosition(
                null
              )
            }
          />
        </div>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Pozice
            </h2>

            <div className="panel-subtitle">
              Seřazeno podle
              aktuální tržní hodnoty
            </div>
          </div>

          <div
            style={{
              width:
                '260px',

              maxWidth:
                '100%',
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

        {sortedPositions.length >
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

                  <th className="cell-number">
                    Počet
                  </th>

                  <th className="cell-number">
                    Podíl
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
                </tr>
              </thead>

              <tbody>
                {sortedPositions.map(
                  (position) => {
                    const cost =
                      position.total_cost

                    const value =
                      position.current_value

                    const quantity =
                      position.quantity

                    const profit =
                      value - cost

                    const returnPercent =
                      cost > 0
                        ? (
                            profit /
                            cost
                          ) * 100
                        : 0

                    const weight =
                      totals.value > 0
                        ? (
                            value /
                            totals.value
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
                          <button
                            className="text-link"
                            onClick={() =>
                              setSelectedPosition(
                                position
                              )
                            }
                          >
                            <span className="instrument-name">
                              {position
                                .instruments
                                ?.name ??
                                'Neznámý instrument'}
                            </span>
                          </button>
                        </td>

                        <td className="cell-text">
                          <span className="cell-muted">
                            {position
                              .instruments
                              ?.ticker ??
                              '—'}
                          </span>
                        </td>

                        <td className="cell-text">
                          <span className="cell-muted">
                            {position
                              .instruments
                              ?.asset_type ??
                              '—'}
                          </span>
                        </td>

                        <td className="cell-number">
                          {formatQuantity(
                            quantity
                          )}
                        </td>

                        <td className="cell-number">
                          {formatWeight(
                            weight
                          )}
                        </td>

                        <td className="cell-number">
                          {formatMoney(
                            cost
                          )}
                        </td>

                        <td className="cell-number">
                          <strong>
                            {formatMoney(
                              value
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
                      </tr>
                    )
                  }
                )}
              </tbody>

              <tfoot>
                <tr
                  style={{
                    background:
                      '#fafbfc',

                    borderTop:
                      '1px solid var(--border)',
                  }}
                >
                  <td
                    colSpan={4}
                    style={{
                      padding:
                        '13px 14px',

                      fontWeight:
                        600,
                    }}
                  >
                    Celkem
                  </td>

                  <td className="cell-number">
                    100,0 %
                  </td>

                  <td className="cell-number">
                    {formatMoney(
                      totals.cost
                    )}
                  </td>

                  <td className="cell-number">
                    <strong>
                      {formatMoney(
                        totals.value
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
                      totals.returnPercent > 0
                        ? 'cell-number cell-positive'
                        : totals.returnPercent < 0
                          ? 'cell-number cell-negative'
                          : 'cell-number'
                    }
                  >
                    {formatPercent(
                      totals.returnPercent
                    )}
                  </td>
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
              : 'Portfolio neobsahuje žádné pozice.'}
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