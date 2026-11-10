import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  supabase,
} from '../lib/supabase'

import {
  updateMarketPrices,
  type PriceUpdateResult,
} from '../services/priceUpdater'

import {
  getManualInstruments,
  getManualValuationOverview,
  importManualPrices,
  saveManualTotalValue,
  saveManualUnitPrice,
  type ManualInstrument,
  type ManualValuationOverview,
} from '../services/manualValuation'

import {
  parseManualPriceCsv,
} from '../services/manualPriceCsv'

type Props = {
  onPricesUpdated?: () => void
}

type MarketRow = {
  id: string
  name: string
  ticker: string
  currency: string
  closePrice: number | null
  priceDate: string | null
  source: string | null
}

function getToday() {
  return new Date()
    .toISOString()
    .slice(0, 10)
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

function formatNumber(
  value: number,
  maximumFractionDigits = 4
) {
  return value.toLocaleString(
    'cs-CZ',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }
  )
}

function formatPrice(
  value: number | null,
  currency: string
) {
  if (value === null) {
    return '—'
  }

  return `${formatNumber(
    value,
    6
  )} ${currency}`.trim()
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

function sourceName(
  source: string | null,
  valuationMode:
    | 'unit_price'
    | 'total_value'
) {
  if (
    source ===
    'MANUAL_IMPORT'
  ) {
    return 'CSV import'
  }

  if (
    source ===
    'MANUAL'
  ) {
    return 'Ruční cena'
  }

  if (
    valuationMode ===
    'total_value'
  ) {
    return 'Ruční hodnota'
  }

  return '—'
}

function sourceBadgeClass(
  source: string | null
) {
  if (
    source ===
    'YAHOO' ||
    source ===
    'YAHOO_BACKFILL'
  ) {
    return 'badge badge-gray'
  }

  if (
    source ===
    'MANUAL_IMPORT'
  ) {
    return 'badge badge-gray'
  }

  return 'badge badge-gray'
}

export default function MarketData({
  onPricesUpdated,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    )

  const [
    automaticRows,
    setAutomaticRows,
  ] = useState<MarketRow[]>([])

  const [
    manualInstruments,
    setManualInstruments,
  ] = useState<
    ManualInstrument[]
  >([])

  const [
    manualOverview,
    setManualOverview,
  ] = useState<
    ManualValuationOverview[]
  >([])

  const [
    selectedManualId,
    setSelectedManualId,
  ] = useState('')

  const [
    valuationDate,
    setValuationDate,
  ] = useState(
    getToday()
  )

  const [
    manualValue,
    setManualValue,
  ] = useState('')

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null
    )

  const [
    updateResult,
    setUpdateResult,
  ] =
    useState<
      PriceUpdateResult | null
    >(null)

  const [
    loadingPage,
    setLoadingPage,
  ] = useState(true)

  const [
    loadingPrices,
    setLoadingPrices,
  ] = useState(false)

  const [
    loadingManual,
    setLoadingManual,
  ] = useState(false)

  const [
    automaticMessage,
    setAutomaticMessage,
  ] = useState('')

  const [
    manualMessage,
    setManualMessage,
  ] = useState('')

  const [
    pageError,
    setPageError,
  ] = useState('')

  const selectedManual =
    useMemo(
      () =>
        manualInstruments.find(
          (instrument) =>
            instrument.id ===
            selectedManualId
        ) ?? null,
      [
        manualInstruments,
        selectedManualId,
      ]
    )

  const automaticStats =
    useMemo(() => {
      const priced =
        automaticRows.filter(
          (row) =>
            row.closePrice !==
            null
        ).length

      const latestDates =
        automaticRows
          .map(
            (row) =>
              row.priceDate
          )
          .filter(
            (
              date
            ): date is string =>
              Boolean(date)
          )
          .sort()

      return {
        total:
          automaticRows.length,

        priced,

        latestDate:
          latestDates[
            latestDates.length -
              1
          ] ?? null,
      }
    }, [automaticRows])

  const manualStats =
    useMemo(() => {
      const totalValue =
        manualOverview.reduce(
          (sum, row) =>
            sum +
            Number(
              row.currentValue
            ),
          0
        )

      const unitPriceCount =
        manualOverview.filter(
          (row) =>
            row.valuationMode ===
            'unit_price'
        ).length

      const totalValueCount =
        manualOverview.filter(
          (row) =>
            row.valuationMode ===
            'total_value'
        ).length

      return {
        total:
          manualOverview.length,

        totalValue,

        unitPriceCount,

        totalValueCount,
      }
    }, [manualOverview])

  const loadAutomaticPrices =
    useCallback(async () => {
      const {
        data: instruments,
        error: instrumentsError,
      } = await supabase
        .from('instruments')
        .select(`
          id,
          name,
          ticker,
          currency
        `)
        .eq(
          'pricing_source',
          'yahoo'
        )
        .not(
          'ticker',
          'is',
          null
        )
        .order('ticker')

      if (instrumentsError) {
        throw instrumentsError
      }

      const instrumentIds =
        (
          instruments ?? []
        ).map(
          (instrument) =>
            instrument.id
        )

      let priceRows:
        Array<{
          instrument_id: string
          close_price:
            | number
            | string
          price_date: string
          source:
            | string
            | null
        }> = []

      if (
        instrumentIds.length >
        0
      ) {
        const {
          data: prices,
          error: pricesError,
        } = await supabase
          .from(
            'price_history'
          )
          .select(`
            instrument_id,
            close_price,
            price_date,
            source
          `)
          .in(
            'instrument_id',
            instrumentIds
          )
          .order(
            'price_date',
            {
              ascending: false,
            }
          )

        if (pricesError) {
          throw pricesError
        }

        priceRows =
          prices ?? []
      }

      const latestPriceByInstrument =
        new Map<
          string,
          {
            close_price:
              | number
              | string
            price_date: string
            source:
              | string
              | null
          }
        >()

      for (
        const price of
        priceRows
      ) {
        if (
          !latestPriceByInstrument.has(
            price.instrument_id
          )
        ) {
          latestPriceByInstrument.set(
            price.instrument_id,
            price
          )
        }
      }

      const output =
        (
          instruments ?? []
        ).map(
          (instrument) => {
            const latest =
              latestPriceByInstrument.get(
                instrument.id
              )

            return {
              id:
                instrument.id,

              name:
                instrument.name,

              ticker:
                instrument.ticker ??
                '',

              currency:
                instrument.currency ??
                '',

              closePrice:
                latest
                  ? Number(
                      latest.close_price
                    )
                  : null,

              priceDate:
                latest
                  ?.price_date ??
                null,

              source:
                latest
                  ?.source ??
                null,
            }
          }
        )

      setAutomaticRows(
        output
      )
    }, [])

  const loadManualData =
    useCallback(async () => {
      const [
        instruments,
        overview,
      ] = await Promise.all([
        getManualInstruments(),

        getManualValuationOverview(),
      ])

      setManualInstruments(
        instruments
      )

      setManualOverview(
        overview
      )

      setSelectedManualId(
        (current) => {
          const currentExists =
            instruments.some(
              (instrument) =>
                instrument.id ===
                current
            )

          if (
            current &&
            currentExists
          ) {
            return current
          }

          return (
            instruments[0]
              ?.id ??
            ''
          )
        }
      )
    }, [])

  const loadAll =
    useCallback(async () => {
      await Promise.all([
        loadAutomaticPrices(),
        loadManualData(),
      ])
    }, [
      loadAutomaticPrices,
      loadManualData,
    ])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoadingPage(true)
        setPageError('')

        await loadAll()
      } catch (error) {
        console.error(
          'Market data:',
          error
        )

        if (!cancelled) {
          setPageError(
            'Tržní data se nepodařilo načíst.'
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingPage(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [loadAll])

  async function handleAutomaticUpdate() {
    try {
      setLoadingPrices(true)

      setAutomaticMessage(
        'Aktualizuji ceny a měnové kurzy...'
      )

      const result =
        await updateMarketPrices()

      setUpdateResult(
        result
      )

      await loadAutomaticPrices()

      if (
        result.errorCount === 0
      ) {
        setAutomaticMessage(
          `Aktualizováno ${result.updatedCount} z ${result.processed} instrumentů.`
        )
      } else {
        setAutomaticMessage(
          `Aktualizováno ${result.updatedCount} z ${result.processed}. Chyb: ${result.errorCount}.`
        )
      }

      onPricesUpdated?.()
    } catch (error) {
      console.error(
        'Price update:',
        error
      )

      setAutomaticMessage(
        'Aktualizace cen se nezdařila. Používají se poslední dostupné ceny.'
      )
    } finally {
      setLoadingPrices(false)
    }
  }

  async function handleManualSave() {
    if (!selectedManual) {
      setManualMessage(
        'Vyber instrument.'
      )

      return
    }

    const numericValue =
      parseNumericInput(
        manualValue
      )

    if (
      numericValue === null ||
      numericValue <= 0
    ) {
      setManualMessage(
        'Zadej kladnou cenu nebo hodnotu.'
      )

      return
    }

    try {
      setLoadingManual(true)
      setManualMessage('')

      if (
        selectedManual
          .valuation_mode ===
        'total_value'
      ) {
        await saveManualTotalValue(
          selectedManual.id,
          numericValue
        )

        setManualMessage(
          'Celková hodnota pozice byla uložena.'
        )
      } else {
        await saveManualUnitPrice(
          selectedManual.id,
          valuationDate,
          numericValue
        )

        setManualMessage(
          'Cena byla uložena a pozice přeceněna.'
        )
      }

      setManualValue('')

      await loadManualData()

      onPricesUpdated?.()
    } catch (error) {
      console.error(
        'Manual valuation:',
        error
      )

      setManualMessage(
        error instanceof Error
          ? error.message
          : 'Ruční ocenění se nezdařilo.'
      )
    } finally {
      setLoadingManual(false)
    }
  }

  async function handleCsvImport() {
    if (!selectedManual) {
      setManualMessage(
        'Vyber instrument.'
      )

      return
    }

    if (
      selectedManual
        .valuation_mode !==
      'unit_price'
    ) {
      setManualMessage(
        'CSV import je dostupný pouze pro cenu za jednotku.'
      )

      return
    }

    if (!selectedFile) {
      setManualMessage(
        'Vyber CSV soubor.'
      )

      return
    }

    try {
      setLoadingManual(true)
      setManualMessage('')

      const content =
        await selectedFile.text()

      const rows =
        parseManualPriceCsv(
          content
        )

      const result =
        await importManualPrices(
          selectedManual.id,
          rows
        )

      setManualMessage(
        `Importováno ${result.importedCount.toLocaleString(
          'cs-CZ'
        )} cen. Poslední ocenění ${formatNumber(
          result.latestPrice,
          6
        )} k ${formatDate(
          result.latestDate
        )}.`
      )

      setSelectedFile(null)

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          ''
      }

      await loadManualData()

      onPricesUpdated?.()
    } catch (error) {
      console.error(
        'CSV import:',
        error
      )

      setManualMessage(
        error instanceof Error
          ? error.message
          : 'Import CSV se nezdařil.'
      )
    } finally {
      setLoadingManual(false)
    }
  }

  if (loadingPage) {
    return (
      <div className="page">
        <div className="loading-box">
          Načítám tržní data...
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="page">
        <div className="error-box">
          {pageError}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            Tržní data
          </h1>

          <p className="page-subtitle">
            Automatické tržní ceny,
            měnové kurzy a ručně
            spravovaná ocenění
            neveřejných aktiv.
          </p>
        </div>

        <button
          className="button-primary"
          onClick={
            handleAutomaticUpdate
          }
          disabled={
            loadingPrices
          }
        >
          {loadingPrices
            ? 'Aktualizuji...'
            : 'Aktualizovat ceny'}
        </button>
      </header>

      <section className="kpi-grid">
        <MetricCard
          label="Automatické instrumenty"
          value={automaticStats.total.toLocaleString(
            'cs-CZ'
          )}
          description={`${automaticStats.priced.toLocaleString(
            'cs-CZ'
          )} oceněno`}
        />

        <MetricCard
          label="Ruční instrumenty"
          value={manualStats.total.toLocaleString(
            'cs-CZ'
          )}
          description={`${manualStats.unitPriceCount} jednotkových · ${manualStats.totalValueCount} celkových`}
        />

        <MetricCard
          label="Hodnota ručních aktiv"
          value={formatCompactMoney(
            manualStats.totalValue
          )}
          description={formatMoney(
            manualStats.totalValue
          )}
        />

        <MetricCard
          label="Poslední tržní datum"
          value={formatDate(
            automaticStats.latestDate
          )}
          description={
            automaticMessage ||
            'Poslední dostupná ocenění'
          }
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">
              Automatické ocenění
            </h2>

            <div className="panel-subtitle">
              Ceny veřejně
              obchodovaných instrumentů
            </div>
          </div>

          {updateResult?.fx && (
            <div
              style={{
                display: 'flex',
                gap: '22px',
                flexWrap: 'wrap',
                justifyContent:
                  'flex-end',
              }}
            >
              <FxValue
                label="USD/CZK"
                value={
                  updateResult.fx
                    .USDCZK
                }
              />

              <FxValue
                label="EUR/CZK"
                value={
                  updateResult.fx
                    .EURCZK
                }
              />
            </div>
          )}
        </div>

        {automaticMessage && (
          <StatusMessage
            message={
              automaticMessage
            }
            error={
              automaticMessage
                .toLowerCase()
                .includes(
                  'nezdařila'
                )
            }
          />
        )}

        <div
          style={{
            overflowX: 'auto',
          }}
        >
          <table className="financial-table">
            <thead>
              <tr>
                <th className="cell-text">
                  Ticker
                </th>

                <th className="cell-text">
                  Instrument
                </th>

                <th className="cell-text">
                  Měna
                </th>

                <th className="cell-number">
                  Poslední cena
                </th>

                <th className="cell-date">
                  Datum
                </th>

                <th className="cell-text">
                  Zdroj
                </th>
              </tr>
            </thead>

            <tbody>
              {automaticRows.map(
                (row) => (
                  <tr
                    key={row.id}
                  >
                    <td className="cell-text">
                      <span
                        style={{
                          fontWeight:
                            600,

                          fontVariantNumeric:
                            'tabular-nums',
                        }}
                      >
                        {row.ticker}
                      </span>
                    </td>

                    <td className="cell-text">
                      <span className="instrument-name">
                        {row.name}
                      </span>
                    </td>

                    <td className="cell-text">
                      <span className="cell-muted">
                        {row.currency ||
                          '—'}
                      </span>
                    </td>

                    <td className="cell-number">
                      <strong
                        style={{
                          fontWeight:
                            600,
                        }}
                      >
                        {formatPrice(
                          row.closePrice,
                          row.currency
                        )}
                      </strong>
                    </td>

                    <td className="cell-date">
                      {formatDate(
                        row.priceDate
                      )}
                    </td>

                    <td className="cell-text">
                      <span
                        className={sourceBadgeClass(
                          row.source
                        )}
                      >
                        Yahoo Finance
                      </span>
                    </td>
                  </tr>
                )
              )}

              {automaticRows.length ===
                0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding:
                        '28px',

                      color:
                        'var(--text-secondary)',

                      textAlign:
                        'center',
                    }}
                  >
                    Nejsou dostupné
                    žádné automaticky
                    oceňované
                    instrumenty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
              Ruční ocenění
            </h2>

            <div className="panel-subtitle">
              NAV, neveřejné fondy,
              penzijní produkty a
              ostatní ručně spravovaná
              aktiva
            </div>
          </div>
        </div>

        <div
          style={{
            overflowX: 'auto',
          }}
        >
          <table className="financial-table">
            <thead>
              <tr>
                <th className="cell-text">
                  Instrument
                </th>

                <th className="cell-text">
                  Režim
                </th>

                <th className="cell-number">
                  Počet
                </th>

                <th className="cell-number">
                  Cena / NAV
                </th>

                <th className="cell-date">
                  Datum
                </th>

                <th className="cell-number">
                  Hodnota pozice
                </th>

                <th className="cell-text">
                  Zdroj
                </th>
              </tr>
            </thead>

            <tbody>
              {manualOverview.map(
                (row) => (
                  <tr
                    key={row.id}
                  >
                    <td className="cell-text">
                      <span className="instrument-name">
                        {row.name}
                      </span>

                      {row.ticker && (
                        <div
                          style={{
                            marginTop:
                              '2px',

                            color:
                              'var(--text-muted)',

                            fontSize:
                              '11px',
                          }}
                        >
                          {row.ticker}
                        </div>
                      )}
                    </td>

                    <td className="cell-text">
                      <span className="cell-muted">
                        {row.valuationMode ===
                        'total_value'
                          ? 'Celková hodnota'
                          : 'Cena za jednotku'}
                      </span>
                    </td>

                    <td className="cell-number">
                      {row.valuationMode ===
                      'unit_price'
                        ? formatNumber(
                            row.quantity,
                            6
                          )
                        : '—'}
                    </td>

                    <td className="cell-number">
                      {row.latestPrice !==
                      null
                        ? formatPrice(
                            row.latestPrice,
                            row.currency ??
                              ''
                          )
                        : '—'}
                    </td>

                    <td className="cell-date">
                      {formatDate(
                        row.latestDate
                      )}
                    </td>

                    <td className="cell-number">
                      <strong
                        style={{
                          fontWeight:
                            600,
                        }}
                      >
                        {formatMoney(
                          row.currentValue
                        )}
                      </strong>
                    </td>

                    <td className="cell-text">
                      <span className="badge badge-gray">
                        {sourceName(
                          row.priceSource,
                          row.valuationMode
                        )}
                      </span>
                    </td>
                  </tr>
                )
              )}

              {manualOverview.length ===
                0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding:
                        '28px',

                      color:
                        'var(--text-secondary)',

                      textAlign:
                        'center',
                    }}
                  >
                    Nejsou dostupné
                    žádné ručně
                    oceňované
                    instrumenty.
                  </td>
                </tr>
              )}
            </tbody>

            {manualOverview.length >
              0 && (
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
                    colSpan={5}
                    style={{
                      padding:
                        '12px 14px',

                      fontWeight:
                        600,
                    }}
                  >
                    Celkem ručně
                    oceňovaná aktiva
                  </td>

                  <td className="cell-number">
                    <strong>
                      {formatMoney(
                        manualStats.totalValue
                      )}
                    </strong>
                  </td>

                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {manualInstruments.length >
        0 && (
        <section
          className="panel"
          style={{
            marginTop: '18px',
          }}
        >
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Aktualizovat ruční
                ocenění
              </h2>

              <div className="panel-subtitle">
                Jednotková cena, NAV
                nebo celková hodnota
                pozice
              </div>
            </div>
          </div>

          <div className="panel-body">
            <div
              style={{
                display: 'grid',

                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',

                gap: '16px',

                alignItems: 'end',
              }}
            >
              <Field
                label="Instrument"
              >
                <select
                  className="form-control"
                  value={
                    selectedManualId
                  }
                  onChange={(
                    event
                  ) => {
                    setSelectedManualId(
                      event.target
                        .value
                    )

                    setManualValue(
                      ''
                    )

                    setManualMessage(
                      ''
                    )

                    setSelectedFile(
                      null
                    )

                    if (
                      fileInputRef.current
                    ) {
                      fileInputRef.current.value =
                        ''
                    }
                  }}
                >
                  {manualInstruments.map(
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

              {selectedManual
                ?.valuation_mode ===
              'unit_price' ? (
                <>
                  <Field
                    label="Datum ocenění"
                  >
                    <input
                      className="form-control"
                      type="date"
                      value={
                        valuationDate
                      }
                      onChange={(
                        event
                      ) =>
                        setValuationDate(
                          event.target
                            .value
                        )
                      }
                    />
                  </Field>

                  <Field
                    label={`Cena za jednotku ${
                      selectedManual
                        .currency ??
                      ''
                    }`}
                  >
                    <input
                      className="form-control"
                      value={
                        manualValue
                      }
                      onChange={(
                        event
                      ) =>
                        setManualValue(
                          event.target
                            .value
                        )
                      }
                      placeholder="157,734"
                      inputMode="decimal"
                    />
                  </Field>
                </>
              ) : (
                <Field
                  label="Celková hodnota pozice v CZK"
                >
                  <input
                    className="form-control"
                    value={
                      manualValue
                    }
                    onChange={(
                      event
                    ) =>
                      setManualValue(
                        event.target
                          .value
                      )
                    }
                    placeholder="1 238 279"
                    inputMode="decimal"
                  />
                </Field>
              )}

              <div>
                <button
                  className="button-primary"
                  onClick={
                    handleManualSave
                  }
                  disabled={
                    loadingManual
                  }
                  style={{
                    width: '100%',
                  }}
                >
                  {loadingManual
                    ? 'Ukládám...'
                    : selectedManual
                        ?.valuation_mode ===
                      'total_value'
                      ? 'Uložit hodnotu'
                      : 'Uložit cenu'}
                </button>
              </div>
            </div>

            {manualMessage && (
              <StatusMessage
                message={
                  manualMessage
                }
                error={
                  manualMessage
                    .toLowerCase()
                    .includes(
                      'nezdař'
                    ) ||
                  manualMessage
                    .toLowerCase()
                    .includes(
                      'zadej'
                    ) ||
                  manualMessage
                    .toLowerCase()
                    .includes(
                      'vyber'
                    )
                }
              />
            )}

            {selectedManual
              ?.valuation_mode ===
              'unit_price' && (
              <div
                style={{
                  marginTop:
                    '26px',

                  paddingTop:
                    '22px',

                  borderTop:
                    '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    display: 'grid',

                    gridTemplateColumns:
                      'minmax(240px, 1fr) auto',

                    gap: '20px',

                    alignItems:
                      'end',
                  }}
                >
                  <div>
                    <div
                      style={{
                        marginBottom:
                          '6px',

                        color:
                          'var(--text)',

                        fontSize:
                          '13px',

                        fontWeight:
                          600,
                      }}
                    >
                      Import historie
                      cen
                    </div>

                    <div
                      style={{
                        marginBottom:
                          '13px',

                        color:
                          'var(--text-secondary)',

                        fontSize:
                          '12px',

                        lineHeight:
                          1.5,
                      }}
                    >
                      CSV se sloupci
                      Datum ocenění a
                      hodnota. Podporován
                      je formát data
                      DD.MM.RRRR,
                      desetinná čárka a
                      oddělovač středník
                      nebo tabulátor.
                    </div>

                    <input
                      ref={
                        fileInputRef
                      }
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(
                        event
                      ) =>
                        setSelectedFile(
                          event.target
                            .files?.[0] ??
                            null
                        )
                      }
                    />

                    {selectedFile && (
                      <div
                        style={{
                          marginTop:
                            '7px',

                          color:
                            'var(--text-muted)',

                          fontSize:
                            '11px',
                        }}
                      >
                        {
                          selectedFile.name
                        }
                      </div>
                    )}
                  </div>

                  <button
                    className="button-secondary"
                    onClick={
                      handleCsvImport
                    }
                    disabled={
                      loadingManual ||
                      !selectedFile
                    }
                  >
                    {loadingManual
                      ? 'Importuji...'
                      : 'Importovat CSV'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
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

function FxValue({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div
      style={{
        textAlign: 'right',
      }}
    >
      <div
        style={{
          color:
            'var(--text-muted)',

          fontSize:
            '10px',

          fontWeight:
            600,

          letterSpacing:
            '0.03em',
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            '3px',

          color:
            'var(--text)',

          fontSize:
            '13px',

          fontWeight:
            600,

          fontVariantNumeric:
            'tabular-nums',
        }}
      >
        {formatNumber(
          value,
          4
        )}
      </div>
    </div>
  )
}

function StatusMessage({
  message,
  error = false,
}: {
  message: string
  error?: boolean
}) {
  return (
    <div
      style={{
        margin:
          '0 20px 18px',

        padding:
          '10px 12px',

        color:
          error
            ? '#8b4444'
            : 'var(--text-secondary)',

        background:
          error
            ? 'var(--danger-soft)'
            : '#f7f8fa',

        border:
          `1px solid ${
            error
              ? '#ead8d8'
              : 'var(--border)'
          }`,

        borderRadius:
          '5px',

        fontSize:
          '12px',

        lineHeight:
          1.45,
      }}
    >
      {message}
    </div>
  )
}