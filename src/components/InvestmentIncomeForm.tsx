import { useEffect, useState } from 'react'
import {
  createInvestmentIncome,
  getIncomeInstruments,
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

function parseNumber(value: string) {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  return normalized === '' ? 0 : Number(normalized)
}

function typeLabel(type: InvestmentIncomeEntryType) {
  if (type === 'DIVIDEND') return 'Dividenda'
  if (type === 'COUPON') return 'Kupón'
  return 'Úrok'
}

export default function InvestmentIncomeForm({
  onSaved,
}: {
  onSaved?: () => void
}) {
  const [instruments, setInstruments] = useState<IncomeInstrument[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<InvestmentIncomeInput>({
    instrumentId: '',
    transactionDate: localDate(),
    transactionType: 'DIVIDEND',
    amountCzk: 0,
    currency: 'CZK',
    fxRate: 1,
    note: '',
  })

  useEffect(() => {
    getIncomeInstruments()
      .then(setInstruments)
      .catch((reason) => {
        console.error('Načtení instrumentů pro příjem:', reason)
        setError('Instrumenty se nepodařilo načíst.')
      })
  }, [])

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
      const result = await createInvestmentIncome(form)
      setMessage(`${typeLabel(result.transactionType)} byla uložena. Hotovost: ${result.cashBalance.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}.`)
      setForm((current) => ({ ...current, amountCzk: 0, note: '' }))
      onSaved?.()
    } catch (reason) {
      console.error('Uložení investičního příjmu:', reason)
      setError(reason instanceof Error ? reason.message : 'Příjem se nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Investiční příjem</h2>
          <div className="panel-subtitle">
            Dividenda, kupón nebo úrok se zapíše k instrumentu a současně navýší Hotovost CZK a dnešní snapshot.
          </div>
        </div>
        <button className="button-secondary" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Zavřít formulář' : 'Přidat příjem'}
        </button>
      </div>

      {expanded && (
        <form className="panel-body" onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <label>
              <span className="form-label">Typ</span>
              <select className="form-control" value={form.transactionType} onChange={(event) => setForm((current) => ({ ...current, transactionType: event.target.value as InvestmentIncomeEntryType }))}>
                <option value="DIVIDEND">Dividenda</option>
                <option value="COUPON">Kupón</option>
                <option value="INTEREST">Úrok</option>
              </select>
            </label>

            <label>
              <span className="form-label">Instrument</span>
              <select className="form-control" required value={form.instrumentId} onChange={(event) => selectInstrument(event.target.value)}>
                <option value="">Vyberte instrument</option>
                {instruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name}{instrument.ticker ? ` (${instrument.ticker})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="form-label">Datum</span>
              <input className="form-control" type="date" required value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
            </label>

            <label>
              <span className="form-label">Čistá přijatá částka v CZK</span>
              <input className="form-control" inputMode="decimal" required value={form.amountCzk || ''} onChange={(event) => setForm((current) => ({ ...current, amountCzk: parseNumber(event.target.value) }))} placeholder="2500" />
            </label>

            <label>
              <span className="form-label">Měna zdroje</span>
              <input className="form-control" maxLength={3} value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
            </label>

            <label>
              <span className="form-label">FX kurz CZK / měna</span>
              <input className="form-control" inputMode="decimal" required value={form.fxRate || ''} onChange={(event) => setForm((current) => ({ ...current, fxRate: parseNumber(event.target.value) }))} />
            </label>
          </div>

          <div style={{ marginTop: '12px' }}>
            <label>
              <span className="form-label">Poznámka</span>
              <input className="form-control" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Volitelná poznámka" />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="button-primary" type="submit" disabled={saving}>
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
