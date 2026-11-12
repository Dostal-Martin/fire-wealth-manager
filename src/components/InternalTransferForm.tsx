import { useEffect, useMemo, useState } from 'react'
import DecimalInput from './DecimalInput'
import {
  createInternalTransfer,
  getTransferAccounts,
  type TransferAccount,
} from '../services/internalTransfer'
import type { InternalTransferInput } from '../domain/internalTransfer'

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatMoney(value: number) {
  return value.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 2 })
}

function accountLabel(account: TransferAccount) {
  return `${account.name}${account.ticker ? ` · ${account.ticker}` : ''} · ${account.currency}`
}

export default function InternalTransferForm({ onSaved }: { onSaved?: () => void }) {
  const [accounts, setAccounts] = useState<TransferAccount[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<InternalTransferInput>({
    transferDate: localDate(), sourceInstrumentId: '', destinationInstrumentId: '',
    sourceAmount: 0, destinationAmount: 0, sourceValueCzk: 0, destinationValueCzk: 0,
    feeCzk: 0, note: '',
  })

  async function loadAccounts() {
    const loaded = await getTransferAccounts()
    setAccounts(loaded)
    setForm((current) => ({
      ...current,
      sourceInstrumentId: current.sourceInstrumentId || loaded[0]?.instrumentId || '',
      destinationInstrumentId: current.destinationInstrumentId || loaded.find((item) => item.instrumentId !== loaded[0]?.instrumentId)?.instrumentId || '',
    }))
  }

  useEffect(() => {
    loadAccounts().catch((reason) => {
      console.error('Hotovostní účty:', reason)
      setError('Hotovostní účty se nepodařilo načíst.')
    })
  }, [])

  const source = useMemo(() => accounts.find((item) => item.instrumentId === form.sourceInstrumentId) ?? null, [accounts, form.sourceInstrumentId])
  const destination = useMemo(() => accounts.find((item) => item.instrumentId === form.destinationInstrumentId) ?? null, [accounts, form.destinationInstrumentId])
  const sameCurrency = Boolean(source && destination && source.currency === destination.currency)

  function changeSourceAmount(sourceAmount: number) {
    setForm((current) => ({
      ...current,
      sourceAmount,
      sourceValueCzk: source?.currency === 'CZK' ? sourceAmount : current.sourceValueCzk,
      destinationAmount: sameCurrency ? sourceAmount : current.destinationAmount,
      destinationValueCzk: sameCurrency && destination?.currency === 'CZK' ? Math.max(0, sourceAmount - current.feeCzk) : current.destinationValueCzk,
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      setSaving(true); setError(''); setMessage('')
      await createInternalTransfer(form)
      setMessage('Interní převod byl uložen.')
      setForm((current) => ({ ...current, sourceAmount: 0, destinationAmount: 0, sourceValueCzk: 0, destinationValueCzk: 0, feeCzk: 0, note: '' }))
      await loadAccounts()
      onSaved?.()
    } catch (reason) {
      console.error('Interní převod:', reason)
      setError(reason instanceof Error ? reason.message : 'Interní převod se nepodařilo uložit.')
    } finally { setSaving(false) }
  }

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div><h2 className="panel-title">Interní převod</h2><div className="panel-subtitle">Přesun mezi hotovostí, spořicími nebo měnovými účty.</div></div>
        <button className="button-secondary" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Zavřít formulář' : 'Nový převod'}</button>
      </div>

      {expanded && (
        <form className="panel-body" onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
            <label><span className="form-label">Datum</span><input className="form-control" type="date" required value={form.transferDate} onChange={(event) => setForm((current) => ({ ...current, transferDate: event.target.value }))} /></label>
            <label><span className="form-label">Z účtu</span><select className="form-control" required value={form.sourceInstrumentId} onChange={(event) => setForm((current) => ({ ...current, sourceInstrumentId: event.target.value }))}><option value="">Vyberte zdroj</option>{accounts.map((account) => <option key={account.instrumentId} value={account.instrumentId}>{accountLabel(account)}</option>)}</select>{source && <small>Hodnota: {formatMoney(source.currentValueCzk)}</small>}</label>
            <label><span className="form-label">Na účet</span><select className="form-control" required value={form.destinationInstrumentId} onChange={(event) => setForm((current) => ({ ...current, destinationInstrumentId: event.target.value }))}><option value="">Vyberte cíl</option>{accounts.map((account) => <option key={account.instrumentId} value={account.instrumentId}>{accountLabel(account)}</option>)}</select>{destination && <small>Hodnota: {formatMoney(destination.currentValueCzk)}</small>}</label>
            <label><span className="form-label">Částka ze zdroje ({source?.currency ?? 'měna'})</span><DecimalInput value={form.sourceAmount} onValueChange={changeSourceAmount} required decimalPlaces={6} /></label>
            <label><span className="form-label">Částka v cíli ({destination?.currency ?? 'měna'})</span><DecimalInput value={form.destinationAmount} onValueChange={(destinationAmount) => setForm((current) => ({ ...current, destinationAmount }))} required decimalPlaces={6} /></label>
            <label><span className="form-label">Hodnota zdroje v CZK</span><DecimalInput value={form.sourceValueCzk} onValueChange={(sourceValueCzk) => setForm((current) => ({ ...current, sourceValueCzk }))} required decimalPlaces={2} /></label>
            <label><span className="form-label">Hodnota cíle v CZK</span><DecimalInput value={form.destinationValueCzk} onValueChange={(destinationValueCzk) => setForm((current) => ({ ...current, destinationValueCzk }))} required decimalPlaces={2} /></label>
            <label><span className="form-label">Poplatek v CZK</span><DecimalInput value={form.feeCzk} onValueChange={(feeCzk) => setForm((current) => ({ ...current, feeCzk }))} decimalPlaces={2} /></label>
          </div>
          <div style={{ marginTop: '12px' }}><label><span className="form-label">Poznámka</span><input className="form-control" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}><button className="button-primary" type="submit" disabled={saving || accounts.length < 2}>{saving ? 'Převádím...' : 'Provést interní převod'}</button></div>
          {error && <div className="error-box" style={{ marginTop: '12px' }}>{error}</div>}
          {message && <div style={{ marginTop: '12px', color: '#416653', fontSize: '12px' }}>{message}</div>}
        </form>
      )}
    </section>
  )
}
