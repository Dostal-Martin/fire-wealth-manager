import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { supabase } from '../lib/supabase'
import { saveTodaySnapshot } from '../services/netWorth'
import {
  getStoredMarketFx,
  updateMarketPrices,
  type MarketFx,
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
  type ValuationFreshness,
} from '../services/manualValuation'
import { parseManualPriceCsv } from '../services/manualPriceCsv'

type Props = { onPricesUpdated?: () => void }

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
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseNumericInput(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  const result = Number(normalized)
  return Number.isFinite(result) ? result : null
}

function formatNumber(value: number, maximumFractionDigits = 4) {
  return value.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits })
}

function formatPrice(value: number | null, currency: string) {
  return value === null ? '—' : `${formatNumber(value, 6)} ${currency}`.trim()
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatCompactMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} mil. Kč`
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} tis. Kč`
  }
  return formatMoney(value)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('cs-CZ')
}

function sourceName(source: string | null, valuationMode: 'unit_price' | 'total_value') {
  if (source === 'MANUAL_IMPORT') return 'CSV import'
  if (source === 'MANUAL') return 'Ruční cena'
  if (valuationMode === 'total_value') return 'Ruční hodnota'
  return '—'
}

function sourceBadgeClass(_source: string | null) {
  return 'badge badge-gray'
}

function getFreshnessText(row: ManualValuationOverview) {
  if (row.valuationFreshness === 'missing') return 'Chybí datum ocenění'
  if (row.valuationFreshness === 'warning') return 'Starší ocenění'
  if (row.valuationFreshness === 'stale') return 'Neaktuální ocenění'
  if (row.valuationAgeDays === 0) return 'Dnes'
  if (row.valuationAgeDays === 1) return '1 den'
  if (row.valuationAgeDays !== null) return `${row.valuationAgeDays.toLocaleString('cs-CZ')} dní`
  return '—'
}

function getFreshnessDetail(row: ManualValuationOverview) {
  if (row.valuationAgeDays === null || row.valuationFreshness === 'fresh') return null
  return `${row.valuationAgeDays.toLocaleString('cs-CZ')} dní`
}

function getFreshnessStyle(freshness: ValuationFreshness) {
  if (freshness === 'warning') {
    return { color: '#84611f', background: '#fff7df', border: '1px solid #ead9a4' }
  }
  if (freshness === 'stale' || freshness === 'missing') {
    return { color: '#8b4444', background: 'var(--danger-soft)', border: '1px solid #ead8d8' }
  }
  return { color: 'var(--text-secondary)', background: '#f7f8fa', border: '1px solid var(--border)' }
}

export default function MarketData({ onPricesUpdated }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [automaticRows, setAutomaticRows] = useState<MarketRow[]>([])
  const [marketFx, setMarketFx] = useState<MarketFx | null>(null)
  const [manualInstruments, setManualInstruments] = useState<ManualInstrument[]>([])
  const [manualOverview, setManualOverview] = useState<ManualValuationOverview[]>([])
  const [selectedManualId, setSelectedManualId] = useState('')
  const [valuationDate, setValuationDate] = useState(getToday())
  const [manualValue, setManualValue] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [updateResult, setUpdateResult] = useState<PriceUpdateResult | null>(null)
  const [loadingPage, setLoadingPage] = useState(true)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [loadingManual, setLoadingManual] = useState(false)
  const [automaticMessage, setAutomaticMessage] = useState('')
  const [manualMessage, setManualMessage] = useState('')
  const [pageError, setPageError] = useState('')

  const selectedManual = useMemo(
    () => manualInstruments.find((instrument) => instrument.id === selectedManualId) ?? null,
    [manualInstruments, selectedManualId],
  )

  const selectedManualIsLiability =
    selectedManual?.asset_type?.toLocaleLowerCase('cs') === 'pasivum'

  const automaticStats = useMemo(() => {
    const priced = automaticRows.filter((row) => row.closePrice !== null).length
    const dates = automaticRows.map((row) => row.priceDate).filter((date): date is string => Boolean(date)).sort()
    return { total: automaticRows.length, priced, latestDate: dates.at(-1) ?? null }
  }, [automaticRows])

  const manualStats = useMemo(() => {
    const totalValue = manualOverview.reduce((sum, row) => sum + Number(row.currentValue), 0)
    const unitPriceCount = manualOverview.filter((row) => row.valuationMode === 'unit_price').length
    const totalValueCount = manualOverview.filter((row) => row.valuationMode === 'total_value').length
    const attentionCount = manualOverview.filter((row) => ['warning', 'stale', 'missing'].includes(row.valuationFreshness)).length
    return { total: manualOverview.length, totalValue, unitPriceCount, totalValueCount, attentionCount }
  }, [manualOverview])

  const loadAutomaticPrices = useCallback(async () => {
    const { data: instruments, error: instrumentsError } = await supabase
      .from('instruments')
      .select('id,name,ticker,currency')
      .eq('pricing_source', 'yahoo')
      .not('ticker', 'is', null)
      .order('ticker')
    if (instrumentsError) throw instrumentsError

    const ids = (instruments ?? []).map((instrument) => instrument.id)
    let priceRows: Array<{ instrument_id: string; close_price: number | string; price_date: string; source: string | null }> = []
    if (ids.length > 0) {
      const { data, error } = await supabase
        .from('price_history')
        .select('instrument_id,close_price,price_date,source')
        .in('instrument_id', ids)
        .order('price_date', { ascending: false })
      if (error) throw error
      priceRows = data ?? []
    }

    const latest = new Map<string, (typeof priceRows)[number]>()
    for (const price of priceRows) if (!latest.has(price.instrument_id)) latest.set(price.instrument_id, price)

    setAutomaticRows((instruments ?? []).map((instrument) => {
      const price = latest.get(instrument.id)
      return {
        id: instrument.id,
        name: instrument.name,
        ticker: instrument.ticker ?? '',
        currency: instrument.currency ?? '',
        closePrice: price ? Number(price.close_price) : null,
        priceDate: price?.price_date ?? null,
        source: price?.source ?? null,
      }
    }))
  }, [])

  const loadStoredFx = useCallback(async () => setMarketFx(await getStoredMarketFx()), [])

  const loadManualData = useCallback(async () => {
    const [instruments, overview] = await Promise.all([getManualInstruments(), getManualValuationOverview()])
    setManualInstruments(instruments)
    setManualOverview(overview)
    setSelectedManualId((current) => current && instruments.some((item) => item.id === current) ? current : instruments[0]?.id ?? '')
  }, [])

  const loadAll = useCallback(async () => {
    await Promise.all([loadAutomaticPrices(), loadStoredFx(), loadManualData()])
  }, [loadAutomaticPrices, loadStoredFx, loadManualData])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoadingPage(true)
        setPageError('')
        await loadAll()
      } catch (error) {
        console.error('Market data:', error)
        if (!cancelled) setPageError('Tržní data se nepodařilo načíst.')
      } finally {
        if (!cancelled) setLoadingPage(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [loadAll])

  async function handleAutomaticUpdate() {
    try {
      setLoadingPrices(true)
      setAutomaticMessage('Aktualizuji ceny a měnové kurzy...')
      const result = await updateMarketPrices()
      setUpdateResult(result)
      if (result.fx) setMarketFx(result.fx)
      await loadAutomaticPrices()
      setAutomaticMessage(result.errorCount === 0
        ? `Aktualizováno ${result.updatedCount} z ${result.processed} instrumentů.`
        : `Aktualizováno ${result.updatedCount} z ${result.processed}. Chyb: ${result.errorCount}.`)
      onPricesUpdated?.()
    } catch (error) {
      console.error('Price update:', error)
      setAutomaticMessage('Aktualizace cen se nezdařila. Používají se poslední dostupné ceny.')
    } finally {
      setLoadingPrices(false)
    }
  }

  async function handleManualSave() {
    if (!selectedManual) {
      setManualMessage('Vyber instrument.')
      return
    }

    const numericValue = parseNumericInput(manualValue)
    if (numericValue === null || numericValue === 0) {
      setManualMessage('Zadej nenulovou cenu nebo hodnotu.')
      return
    }
    if (selectedManual.valuation_mode === 'unit_price' && numericValue < 0) {
      setManualMessage('Cena za jednotku musí být větší než nula.')
      return
    }
    if (!valuationDate) {
      setManualMessage('Vyber datum ocenění.')
      return
    }

    try {
      setLoadingManual(true)
      setManualMessage('')
      let successMessage = ''

      if (selectedManual.valuation_mode === 'total_value') {
        const result = await saveManualTotalValue(selectedManual.id, numericValue, valuationDate)
        successMessage = result.isLiability
          ? `Výše závazku byla uložena jako ${formatMoney(result.storedValue)}.`
          : 'Celková hodnota pozice byla uložena.'
      } else {
        await saveManualUnitPrice(selectedManual.id, valuationDate, numericValue)
        successMessage = 'Cena byla uložena a pozice přeceněna.'
      }

      const snapshot = await saveTodaySnapshot()
      setManualValue('')
      await loadManualData()
      setManualMessage(`${successMessage} Dnešní snapshot byl aktualizován na ${formatMoney(snapshot.netWorth)}.`)
      onPricesUpdated?.()
    } catch (error) {
      console.error('Manual valuation:', error)
      setManualMessage(error instanceof Error ? error.message : 'Ruční ocenění se nezdařilo.')
    } finally {
      setLoadingManual(false)
    }
  }

  async function handleCsvImport() {
    if (!selectedManual) return setManualMessage('Vyber instrument.')
    if (selectedManual.valuation_mode !== 'unit_price') return setManualMessage('CSV import je dostupný pouze pro cenu za jednotku.')
    if (!selectedFile) return setManualMessage('Vyber CSV soubor.')

    try {
      setLoadingManual(true)
      setManualMessage('')
      const rows = parseManualPriceCsv(await selectedFile.text())
      const result = await importManualPrices(selectedManual.id, rows)
      const snapshot = await saveTodaySnapshot()
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadManualData()
      setManualMessage(`Importováno ${result.importedCount.toLocaleString('cs-CZ')} cen. Poslední ocenění ${formatNumber(result.latestPrice, 6)} k ${formatDate(result.latestDate)}. Dnešní snapshot byl aktualizován na ${formatMoney(snapshot.netWorth)}.`)
      onPricesUpdated?.()
    } catch (error) {
      console.error('CSV import:', error)
      setManualMessage(error instanceof Error ? error.message : 'Import CSV se nezdařil.')
    } finally {
      setLoadingManual(false)
    }
  }

  const displayedFx = updateResult?.fx ?? marketFx

  if (loadingPage) return <div className="page"><div className="loading-box">Načítám tržní data...</div></div>
  if (pageError) return <div className="page"><div className="error-box">{pageError}</div></div>

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Tržní data</h1>
          <p className="page-subtitle">Automatické tržní ceny, měnové kurzy a ručně spravovaná ocenění neveřejných aktiv a pasiv.</p>
        </div>
        <button className="button-primary" onClick={handleAutomaticUpdate} disabled={loadingPrices}>
          {loadingPrices ? 'Aktualizuji...' : 'Aktualizovat ceny'}
        </button>
      </header>

      <section className="kpi-grid">
        <MetricCard label="Automatické instrumenty" value={automaticStats.total.toLocaleString('cs-CZ')} description={`${automaticStats.priced.toLocaleString('cs-CZ')} oceněno`} />
        <MetricCard label="Ruční instrumenty" value={manualStats.total.toLocaleString('cs-CZ')} description={manualStats.attentionCount > 0 ? `${manualStats.attentionCount.toLocaleString('cs-CZ')} vyžaduje pozornost` : `${manualStats.unitPriceCount} jednotkových · ${manualStats.totalValueCount} celkových`} />
        <MetricCard label="Hodnota ručních aktiv a pasiv" value={formatCompactMoney(manualStats.totalValue)} description={formatMoney(manualStats.totalValue)} />
        <MetricCard label="Poslední tržní datum" value={formatDate(automaticStats.latestDate)} description={automaticMessage || 'Poslední dostupná ocenění'} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div><h2 className="panel-title">Automatické ocenění</h2><div className="panel-subtitle">Ceny veřejně obchodovaných instrumentů</div></div>
          {displayedFx && <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', justifyContent: 'flex-end' }}><FxValue label="USD/CZK" value={displayedFx.USDCZK} /><FxValue label="EUR/CZK" value={displayedFx.EURCZK} /></div>}
        </div>
        {automaticMessage && <StatusMessage message={automaticMessage} error={automaticMessage.toLowerCase().includes('nezdařila')} />}
        <div style={{ overflowX: 'auto' }}>
          <table className="financial-table">
            <thead><tr><th className="cell-text">Ticker</th><th className="cell-text">Instrument</th><th className="cell-text">Měna</th><th className="cell-number">Poslední cena</th><th className="cell-date">Datum</th><th className="cell-text">Zdroj</th></tr></thead>
            <tbody>
              {automaticRows.map((row) => <tr key={row.id}>
                <td className="cell-text"><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.ticker}</span></td>
                <td className="cell-text"><span className="instrument-name">{row.name}</span></td>
                <td className="cell-text"><span className="cell-muted">{row.currency || '—'}</span></td>
                <td className="cell-number"><strong style={{ fontWeight: 600 }}>{formatPrice(row.closePrice, row.currency)}</strong></td>
                <td className="cell-date">{formatDate(row.priceDate)}</td>
                <td className="cell-text"><span className={sourceBadgeClass(row.source)}>Yahoo Finance</span></td>
              </tr>)}
              {automaticRows.length === 0 && <tr><td colSpan={6} style={{ padding: '28px', color: 'var(--text-secondary)', textAlign: 'center' }}>Nejsou dostupné žádné automaticky oceňované instrumenty.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: '18px' }}>
        <div className="panel-header"><div><h2 className="panel-title">Ruční ocenění</h2><div className="panel-subtitle">NAV, neveřejné fondy, penzijní produkty, pasiva a ostatní ručně spravovaná ocenění</div></div></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="financial-table">
            <thead><tr><th className="cell-text">Instrument</th><th className="cell-text">Režim</th><th className="cell-number">Počet</th><th className="cell-number">Cena / NAV</th><th className="cell-date">Datum</th><th className="cell-text">Aktuálnost</th><th className="cell-number">Hodnota pozice</th><th className="cell-text">Zdroj</th></tr></thead>
            <tbody>
              {manualOverview.map((row) => <tr key={row.id}>
                <td className="cell-text"><span className="instrument-name">{row.name}</span>{row.ticker && <div style={{ marginTop: '2px', color: 'var(--text-muted)', fontSize: '11px' }}>{row.ticker}</div>}</td>
                <td className="cell-text"><span className="cell-muted">{row.valuationMode === 'total_value' ? 'Celková hodnota' : 'Cena za jednotku'}</span></td>
                <td className="cell-number">{row.valuationMode === 'unit_price' ? formatNumber(row.quantity, 6) : '—'}</td>
                <td className="cell-number">{row.latestPrice !== null ? formatPrice(row.latestPrice, row.currency ?? '') : '—'}</td>
                <td className="cell-date">{formatDate(row.latestDate)}</td>
                <td className="cell-text"><FreshnessBadge row={row} /></td>
                <td className={`cell-number ${row.currentValue < 0 ? 'negative' : ''}`}><strong style={{ fontWeight: 600 }}>{formatMoney(row.currentValue)}</strong></td>
                <td className="cell-text"><span className="badge badge-gray">{sourceName(row.priceSource, row.valuationMode)}</span></td>
              </tr>)}
              {manualOverview.length === 0 && <tr><td colSpan={8} style={{ padding: '28px', color: 'var(--text-secondary)', textAlign: 'center' }}>Nejsou dostupné žádné ručně oceňované instrumenty.</td></tr>}
            </tbody>
            {manualOverview.length > 0 && <tfoot><tr style={{ background: '#fafbfc', borderTop: '1px solid var(--border)' }}><td colSpan={6} style={{ padding: '12px 14px', fontWeight: 600 }}>Celkem ručně oceňovaná aktiva a pasiva</td><td className="cell-number"><strong>{formatMoney(manualStats.totalValue)}</strong></td><td /></tr></tfoot>}
          </table>
        </div>
      </section>

      {manualInstruments.length > 0 && (
        <section className="panel" style={{ marginTop: '18px' }}>
          <div className="panel-header"><div><h2 className="panel-title">Aktualizovat ruční ocenění</h2><div className="panel-subtitle">Jednotková cena, NAV, celková hodnota aktiva nebo aktuální výše závazku</div></div></div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'end' }}>
              <Field label="Instrument">
                <select className="form-control" value={selectedManualId} onChange={(event) => {
                  setSelectedManualId(event.target.value)
                  setManualValue('')
                  setManualMessage('')
                  setSelectedFile(null)
                  setValuationDate(getToday())
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}>
                  {manualInstruments.map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.name}</option>)}
                </select>
              </Field>
              <Field label="Datum ocenění"><input className="form-control" type="date" value={valuationDate} onChange={(event) => setValuationDate(event.target.value)} /></Field>

              {selectedManual?.valuation_mode === 'unit_price' ? (
                <Field label={`Cena za jednotku ${selectedManual.currency ?? ''}`}>
                  <input className="form-control" value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="157,734" inputMode="decimal" />
                </Field>
              ) : (
                <Field label={selectedManualIsLiability ? 'Aktuální výše závazku v CZK' : 'Celková hodnota pozice v CZK'}>
                  <input className="form-control" value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder={selectedManualIsLiability ? '722 126,90' : '1 238 279'} inputMode="decimal" />
                  {selectedManualIsLiability && <div style={{ marginTop: '5px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.4 }}>Zadej kladnou nesplacenou jistinu. Pasivum se do čistého majetku automaticky uloží se záporným znaménkem.</div>}
                </Field>
              )}

              <div><button className="button-primary" onClick={handleManualSave} disabled={loadingManual} style={{ width: '100%' }}>{loadingManual ? 'Ukládám...' : selectedManualIsLiability ? 'Uložit závazek' : selectedManual?.valuation_mode === 'total_value' ? 'Uložit hodnotu' : 'Uložit cenu'}</button></div>
            </div>

            {manualMessage && <StatusMessage message={manualMessage} error={['nezdař', 'zadej', 'vyber'].some((word) => manualMessage.toLowerCase().includes(word))} />}

            {selectedManual?.valuation_mode === 'unit_price' && (
              <div style={{ marginTop: '26px', paddingTop: '22px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) auto', gap: '20px', alignItems: 'end' }}>
                  <div>
                    <div style={{ marginBottom: '6px', color: 'var(--text)', fontSize: '13px', fontWeight: 600 }}>Import historie cen</div>
                    <div style={{ marginBottom: '13px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>CSV se sloupci Datum ocenění a hodnota. Podporován je formát data DD.MM.RRRR, desetinná čárka a oddělovač středník nebo tabulátor.</div>
                    <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
                    {selectedFile && <div style={{ marginTop: '7px', color: 'var(--text-muted)', fontSize: '11px' }}>{selectedFile.name}</div>}
                  </div>
                  <button className="button-secondary" onClick={handleCsvImport} disabled={loadingManual || !selectedFile}>{loadingManual ? 'Importuji...' : 'Importovat CSV'}</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function MetricCard({ label, value, description }: { label: string; value: string; description?: string }) {
  return <div className="kpi-card"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div>{description && <div className="kpi-description">{description}</div>}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="form-label">{label}</label>{children}</div>
}

function FreshnessBadge({ row }: { row: ManualValuationOverview }) {
  const style = getFreshnessStyle(row.valuationFreshness)
  const detail = getFreshnessDetail(row)
  return <div><span style={{ display: 'inline-flex', alignItems: 'center', minHeight: '22px', padding: '3px 8px', borderRadius: '999px', color: style.color, background: style.background, border: style.border, fontSize: '11px', fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{getFreshnessText(row)}</span>{detail && <div style={{ marginTop: '3px', color: 'var(--text-muted)', fontSize: '10px' }}>{detail}</div>}</div>
}

function FxValue({ label, value }: { label: string; value: number }) {
  return <div style={{ textAlign: 'right' }}><div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em' }}>{label}</div><div style={{ marginTop: '3px', color: 'var(--text)', fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(value, 4)}</div></div>
}

function StatusMessage({ message, error = false }: { message: string; error?: boolean }) {
  return <div style={{ margin: '14px 0 0', padding: '10px 12px', color: error ? '#8b4444' : 'var(--text-secondary)', background: error ? 'var(--danger-soft)' : '#f7f8fa', border: `1px solid ${error ? '#ead8d8' : 'var(--border)'}`, borderRadius: '5px', fontSize: '12px', lineHeight: 1.45 }}>{message}</div>
}
