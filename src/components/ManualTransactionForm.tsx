import { useEffect, useMemo, useState } from 'react'
import { calculateManualTransactionAmount, type ManualTransactionInput } from '../domain/transactionEntry'
import {
  createManualTransaction,
  getTradableInstruments,
  type TradableInstrument,
} from '../services/transactionEntry'

function localDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function numberValue(value: string) {
  const normalized = value.replace(',', '.').trim()
  return normalized === '' ? 0 : Number(normalized)
}

export default function ManualTransactionForm({ onSaved }: { onSaved: () => void }) {
  const [instruments, setInstruments] = useState<TradableInstrument[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState<ManualTransactionInput>({
    instrumentId: '', transactionDate: localDate(), transactionType: 'BUY', quantity: 0,
    unitPrice: 0, currency: 'CZK', fxRate: 1, feesCzk: 0, taxCzk: 0, note: '',
  })

  useEffect(() => {
    getTradableInstruments()
      .then(setInstruments)
      .catch((reason) => {
        console.error('Načtení instrumentů:', reason)
        setError('Instrumenty se nepodařilo načíst.')
      })
  }, [])

  const amount = useMemo(() => calculateManualTransactionAmount(form), [form])

  function update<K extends keyof ManualTransactionInput>(key: K, value: ManualTransactionInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function selectInstrument(instrumentId: string) {
    const instrument = instruments.find((item) => item.id === instrumentId)
    setForm((current) => ({
      ...current,
      instrumentId,
      currency: instrument?.currency ?? 'CZK',
      fxRate: instrument?.currency === 'CZK' || !instrument ? 1 : current.fxRate,
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setMessage('')
      await createManualTransaction(form)
      setMessage(form.transactionType === 'BUY' ? 'Nákup byl uložen.' : 'Prodej byl uložen.')
      setForm((current) => ({ ...current, quantity: 0, unitPrice: 0, feesCzk: 0, taxCzk: 0, note: '' }))
      onSaved()
    } catch (reason) {
      console.error('Uložení transakce:', reason)
      setError(reason instanceof Error ? reason.message : 'Transakci se nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Nový nákup nebo prodej</h2>
          <div className="panel-subtitle">Transakce se uloží do deníku. Evidované pozice se v této první verzi automaticky nepřepisují.</div>
        </div>
        <button className="button-secondary" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Zavřít formulář' : 'Přidat transakci'}
        </button>
      </div>

      {expanded && (
        <form className="panel-body" onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <Field label="Typ">
              <select className="form-control" value={form.transactionType} onChange={(event) => update('transactionType', event.target.value as 'BUY' | 'SELL')}>
                <option value="BUY">Nákup</option>
                <option value="SELL">Prodej</option>
              </select>
            </Field>
            <Field label="Instrument">
              <select className="form-control" required value={form.instrumentId} onChange={(event) => selectInstrument(event.target.value)}>
                <option value="">Vyberte instrument</option>
                {instruments.map((instrument) => <option key={instrument.id} value={instrument.id}>{instrument.name}{instrument.ticker ? ` (${instrument.ticker})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Datum">
              <input className="form-control" type="date" required value={form.transactionDate} onChange={(event) => update('transactionDate', event.target.value)} />
            </Field>
            <Field label="Množství">
              <input className="form-control" inputMode="decimal" required value={form.quantity || ''} onChange={(event) => update('quantity', numberValue(event.target.value))} />
            </Field>
            <Field label={`Cena za jednotku (${form.currency})`}>
              <input className="form-control" inputMode="decimal" required value={form.unitPrice || ''} onChange={(event) => update('unitPrice', numberValue(event.target.value))} />
            </Field>
            <Field label="Měna">
              <input className="form-control" maxLength={3} value={form.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} />
            </Field>
            <Field label="FX kurz CZK / měna">
              <input className="form-control" inputMode="decimal" required value={form.fxRate || ''} onChange={(event) => update('fxRate', numberValue(event.target.value))} />
            </Field>
            <Field label="Poplatek v CZK">
              <input className="form-control" inputMode="decimal" value={form.feesCzk || ''} onChange={(event) => update('feesCzk', numberValue(event.target.value))} />
            </Field>
            <Field label="Daň v CZK">
              <input className="form-control" inputMode="decimal" value={form.taxCzk || ''} onChange={(event) => update('taxCzk', numberValue(event.target.value))} />
            </Field>
          </div>

          <div style={{ marginTop: '12px' }}>
            <Field label="Poznámka">
              <input className="form-control" value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Volitelná poznámka" />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Hrubá hodnota: <strong>{amount.grossAmountCzk.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</strong><br />
              Ukládaná částka: <strong>{amount.amountCzk.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</strong>
            </div>
            <button className="button-primary" type="submit" disabled={saving}>{saving ? 'Ukládám...' : 'Uložit transakci'}</button>
          </div>

          {error && <div className="error-box" style={{ marginTop: '12px' }}>{error}</div>}
          {message && <div style={{ marginTop: '12px', color: '#416653', fontSize: '12px' }}>{message}</div>}
        </form>
      )}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="form-label">{label}</span>{children}</label>
}
