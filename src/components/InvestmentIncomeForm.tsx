import { useEffect, useMemo, useState } from 'react'
import DecimalInput from './DecimalInput'
import {
  createInvestmentIncome,
  getIncomeCashAccounts,
  getIncomeInstruments,
  type IncomeCashAccount,
  type IncomeInstrument,
} from '../services/investmentIncome'
import type {
  InvestmentIncomeEntryType,
  InvestmentIncomeInput,
} from '../domain/investmentIncome'

function localDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


function typeLabel(type: InvestmentIncomeEntryType) {
  if (type === 'DIVIDEND') return 'Dividenda'
  if (type === 'COUPON') return 'Kupón'
  return 'Úrok'
}

function accountLabel(account: IncomeCashAccount) {
  return `${account.name}${account.ticker ? ` · ${account.ticker}` : ''} · ${account.currency}`
}

export default function InvestmentIncomeForm({ onSaved }: { onSaved?: () => void }) {
  const [instruments, setInstruments] = useState<IncomeInstrument[]>([])
  const [cashAccounts, setCashAccounts] = useState<IncomeCashAccount[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<InvestmentIncomeInput>({
    instrumentId: '',
    cashInstrumentId: '',
    transactionDate: localDate(),
    transactionType: 'DIVIDEND',
    amountNative: 0,
    currency: 'CZK',
    fxRate: 1,
    taxNative: 0,
    feeNative: 0,
    note: '',
  })

  useEffect(() => {
    Promise.all([getIncomeInstruments(), getIncomeCashAccounts()])
      .then(([loadedInstruments, loadedAccounts]) => {
        setInstruments(loadedInstruments)
        setCashAccounts(loadedAccounts)
      })
      .catch((reason) => {
        console.error('Investiční příjem:', reason)
        setError('Číselníky pro investiční příjem se nepodařilo načíst.')
      })
  }, [])

  const selectedInstrument = useMemo(
    () => instruments.find((instrument) => instrument.id === form.instrumentId) ?? null,
    [instruments, form.instrumentId],
  )

  const sourceIsCash = selectedInstrument?.assetType.toLocaleLowerCase('cs') === 'hotovost'

  const matchingAccounts = useMemo(() => {
    const sameCurrency = cashAccounts.filter((account) => account.currency === form.currency)
    if (form.transactionType === 'INTEREST' && sourceIsCash && selectedInstrument) {
      return sameCurrency.filter((account) => account.id === selectedInstrument.id)
    }
    return sameCurrency
  }, [cashAccounts, form.currency, form.transactionType, sourceIsCash, selectedInstrument])

  const netNative = Math.max(0, form.amountNative - form.taxNative - form.feeNative)
  const netCzk = netNative * form.fxRate

  function selectInstrument(instrumentId: string) {
    const instrument = instruments.find((item) => item.id === instrumentId)
    const currency = instrument?.currency ?? 'CZK'
    const isCash = instrument?.assetType.toLocaleLowerCase('cs') === 'hotovost'
    const preferred = isCash
      ? cashAccounts.find((account) => account.id === instrumentId)
      : cashAccounts.find((account) => account.currency === currency)

    setForm((current) => ({
      ...current,
      instrumentId,
      currency,
      fxRate: currency === 'CZK' ? 1 : current.fxRate,
      cashInstrumentId: preferred?.id ?? '',
      transactionType: isCash ? 'INTEREST' : current.transactionType,
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const result = await createInvestmentIncome(form) as Record<string, unknown> | null
      const credited = result ? Number(result.netNative ?? netNative) : netNative
      setMessage(`${typeLabel(form.transactionType)} byla uložena. Na cílový účet bylo připsáno ${credited.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${form.currency}.`)
      setForm((current) => ({ ...current, amountNative: 0, taxNative: 0, feeNative: 0, note: '' }))
      onSaved?.()
    } catch (reason) {
      console.error('Uložení investičního příjmu:', reason)
      setError(reason instanceof Error ? reason.message : 'Investiční příjem se nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Investiční příjem</h2>
          <div className="panel-subtitle">Dividenda, kupón nebo úrok se připíše na vybraný hotovostní účet a současně vstoupí do Total Return.</div>
        </div>
        <button className="button-secondary" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Zavřít formulář' : 'Přidat příjem'}
        </button>
      </div>

      {expanded && (
        <form className="panel-body" onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <label>
              <span className="form-label">Typ</span>
              <select className="form-control" value={form.transactionType} onChange={(event) => { const transactionType = event.target.value as InvestmentIncomeEntryType; setForm((current) => ({ ...current, transactionType })); }}>
                <option value="DIVIDEND">Dividenda</option>
                <option value="COUPON">Kupón</option>
                <option value="INTEREST">Úrok</option>
              </select>
            </label>

            <label>
              <span className="form-label">Zdroj příjmu / instrument</span>
              <select className="form-control" required value={form.instrumentId} onChange={(event) => selectInstrument(event.target.value)}>
                <option value="">Vyberte instrument</option>
                {instruments.map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.name}{instrument.ticker ? ` (${instrument.ticker})` : ''}{instrument.assetType.toLocaleLowerCase('cs') === 'hotovost' ? ' · úrok' : ''}</option>)}
              </select>
            </label>

            <label>
              <span className="form-label">Připsat na účet</span>
              <select className="form-control" required value={form.cashInstrumentId} onChange={(event) => setForm((current) => ({ ...current, cashInstrumentId: event.target.value }))}>
                <option value="">Vyberte účet</option>
                {matchingAccounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
              </select>
              {form.currency && matchingAccounts.length === 0 && <div style={{ marginTop: '4px', color: '#8b4444', fontSize: '10px' }}>Pro měnu {form.currency} není evidovaný hotovostní účet.</div>}
            </label>

            <label>
              <span className="form-label">Datum</span>
              <input className="form-control" type="date" required value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
            </label>

            <label>
              <span className="form-label">Měna</span>
              <input className="form-control" value={form.currency} readOnly />
            </label>

            <label>
              <span className="form-label">Hrubá částka ({form.currency})</span>
              <DecimalInput value={form.amountNative} onValueChange={(amountNative) => setForm((current) => ({ ...current, amountNative }))} required decimalPlaces={4} />
            </label>

            <label>
              <span className="form-label">Daň ({form.currency})</span>
              <DecimalInput value={form.taxNative} onValueChange={(taxNative) => setForm((current) => ({ ...current, taxNative }))} decimalPlaces={4} />
            </label>

            <label>
              <span className="form-label">Poplatek ({form.currency})</span>
              <DecimalInput value={form.feeNative} onValueChange={(feeNative) => setForm((current) => ({ ...current, feeNative }))} decimalPlaces={4} />
            </label>

            <label>
              <span className="form-label">FX kurz do CZK</span>
              <DecimalInput value={form.fxRate} onValueChange={(fxRate) => setForm((current) => ({ ...current, fxRate }))} required readOnly={form.currency === 'CZK'} decimalPlaces={6} />
            </label>
          </div>

          <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <div className="kpi-card">
              <div className="kpi-label">Čistý příjem</div>
              <div className="kpi-value">{netNative.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} {form.currency}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Čistý příjem v CZK</div>
              <div className="kpi-value positive">{netCzk.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          {sourceIsCash && form.transactionType === 'INTEREST' && (
            <div style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5 }}>
              Úrok ze spořicího nebo hotovostního účtu se připíše přímo na tentýž účet. Dividendy a kupóny používají investiční instrument jako zdroj a hotovostní účet stejné měny jako cíl.
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <label>
              <span className="form-label">Poznámka</span>
              <input className="form-control" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Volitelná poznámka" />
            </label>
          </div>

          <div style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5 }}>
            Total Return používá čistý příjem po dani a poplatku. U USD/EUR se hotovost připíše v původní měně a její korunová hodnota se dále automaticky přeceňuje podle FX.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="button-primary" type="submit" disabled={saving || !form.cashInstrumentId}>
              {saving ? 'Ukládám...' : `Uložit: ${typeLabel(form.transactionType)}`}
            </button>
          </div>

          {error && <div className="error-box" style={{ marginTop: '12px' }}>{error}</div>}
          {message && <div style={{ marginTop: '12px', color: '#416653', fontSize: '12px' }}>{message}</div>}
        </form>
      )}
    </section>
  )
}
