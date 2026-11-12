import { useEffect, useMemo, useState } from 'react'
import {
  createInternalTransfer,
  getTransferAccounts,
  type TransferAccount,
} from '../services/internalTransfer'
import type { InternalTransferInput } from '../domain/internalTransfer'

function localDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseNumber(value: string) {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number) {
  return value.toLocaleString('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  })
}

function accountLabel(account: TransferAccount) {
  const ticker = account.ticker ? ` · ${account.ticker}` : ''
  return `${account.name}${ticker} · ${account.currency}`
}

export default function InternalTransferForm({ onSaved }: { onSaved?: () => void }) {
  const [accounts, setAccounts] = useState<TransferAccount[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<InternalTransferInput>({
    transferDate: localDate(),
    sourceInstrumentId: '',
    destinationInstrumentId: '',
    sourceAmount: 0,
    destinationAmount: 0,
    sourceValueCzk: 0,
    destinationValueCzk: 0,
    feeCzk: 0,
    note: '',
  })

  async function loadAccounts() {
    try {
      const loaded = await getTransferAccounts()
      setAccounts(loaded)
      setForm((current) => ({
        ...current,
        sourceInstrumentId: current.sourceInstrumentId || loaded[0]?.instrumentId || '',
        destinationInstrumentId: current.destinationInstrumentId || loaded.find((item) => item.instrumentId !== loaded[0]?.instrumentId)?.instrumentId || '',
      }))
    } catch (reason) {
      console.error('Hotovostní účty:', reason)
      setError(reason instanceof Error ? reason.message : 'Hotovostní účty se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    void loadAccounts()
  }, [])

  const source = useMemo(
    () => accounts.find((item) => item.instrumentId === form.sourceInstrumentId) ?? null,
    [accounts, form.sourceInstrumentId],
  )
  const destination = useMemo(
    () => accounts.find((item) => item.instrumentId === form.destinationInstrumentId) ?? null,
    [accounts, form.destinationInstrumentId],
  )
  const sameCurrency = source && destination && source.currency === destination.currency

  function setSourceAmount(value: string) {
    const amount = parseNumber(value)
    setForm((current) => ({
      ...current,
      sourceAmount: amount,
      sourceValueCzk: source?.currency === 'CZK' ? amount : current.sourceValueCzk,
      destinationAmount: sameCurrency ? amount : current.destinationAmount,
      destinationValueCzk: sameCurrency && destination?.currency === 'CZK' ? amount - current.feeCzk : current.destinationValueCzk,
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setMessage('')
      await createInternalTransfer(form)
      setMessage('Interní převod byl uložen. Celkové čisté jmění se převodem nemění, s výjimkou případného poplatku.')
      setForm((current) => ({
        ...current,
        sourceAmount: 0,
        destinationAmount: 0,
        sourceValueCzk: 0,
        destinationValueCzk: 0,
        feeCzk: 0,
        note: '',
      }))
      await loadAccounts()
      onSaved?.()
    } catch (reason) {
      console.error('Interní převod:', reason)
      setError(reason instanceof Error ? reason.message : 'Interní převod se nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Interní převod</h2>
          <div className="panel-subtitle">
            Přesun mezi hotovostí, spořicími účty nebo měnovými účty uvnitř FIRE WM. Není to vklad, výběr ani investiční výnos.
          </div>
        </div>
        <button className="button-secondary" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Zavřít formulář' : 'Nový převod'}
        </button>
      </div>

      {expanded && (
        <form className="panel-body" onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
            <label>
              <span className="form-label">Datum</span>
              <input className="form-control" type="date" required value={form.transferDate} onChange={(event) => setForm((current) => ({ ...current, transferDate: event.target.value }))} />
            </label>

            <label>
              <span className="form-label">Z účtu</span>
              <select className="form-control" required value={form.sourceInstrumentId} onChange={(event) => setForm((current) => ({ ...current, sourceInstrumentId: event.target.value }))}>
                <option value="">Vyberte zdroj</option>
                {accounts.map((account) => <option key={account.instrumentId} value={account.instrumentId}>{accountLabel(account)}</option>)}
              </select>
              {source && <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '10px' }}>Hodnota: {formatMoney(source.currentValueCzk)}</div>}
            </label>

            <label>
              <span className="form-label">Na účet</span>
              <select className="form-control" required value={form.destinationInstrumentId} onChange={(event) => setForm((current) => ({ ...current, destinationInstrumentId: event.target.value }))}>
                <option value="">Vyberte cíl</option>
                {accounts.map((account) => <option key={account.instrumentId} value={account.instrumentId}>{accountLabel(account)}</option>)}
              </select>
              {destination && <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '10px' }}>Hodnota: {formatMoney(destination.currentValueCzk)}</div>}
            </label>

            <label>
              <span className="form-label">Částka ze zdroje ({source?.currency ?? 'měna'})</span>
              <input className="form-control" inputMode="decimal" required value={form.sourceAmount || ''} onChange={(event) => setSourceAmount(event.target.value)} />
            </label>

            <label>
              <span className="form-label">Částka v cíli ({destination?.currency ?? 'měna'})</span>
              <input className="form-control" inputMode="decimal" required value={form.destinationAmount || ''} onChange={(event) => setForm((current) => ({ ...current, destinationAmount: parseNumber(event.target.value) }))} />
            </label>

            <label>
              <span className="form-label">Hodnota zdroje v CZK</span>
              <input className="form-control" inputMode="decimal" required value={form.sourceValueCzk || ''} onChange={(event) => setForm((current) => ({ ...current, sourceValueCzk: parseNumber(event.target.value) }))} />
            </label>

            <label>
              <span className="form-label">Hodnota cíle v CZK</span>
              <input className="form-control" inputMode="decimal" required value={form.destinationValueCzk || ''} onChange={(event) => setForm((current) => ({ ...current, destinationValueCzk: parseNumber(event.target.value) }))} />
            </label>

            <label>
              <span className="form-label">Poplatek v CZK</span>
              <input className="form-control" inputMode="decimal" value={form.feeCzk || ''} onChange={(event) => setForm((current) => ({ ...current, feeCzk: parseNumber(event.target.value) }))} />
            </label>
          </div>

          <div style={{ marginTop: '12px' }}>
            <label>
              <span className="form-label">Poznámka</span>
              <input className="form-control" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Např. přesun rezervy na spořicí účet" />
            </label>
          </div>

          <div style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5 }}>
            U stejné měny se částky předvyplní shodně. U směny CZK/EUR nebo CZK/USD zadejte skutečně odepsané a připsané množství a jejich korunovou protihodnotu. Rozdíl může tvořit pouze evidovaný poplatek.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="button-primary" type="submit" disabled={saving || accounts.length < 2}>
              {saving ? 'Převádím...' : 'Provést interní převod'}
            </button>
          </div>

          {accounts.length < 2 && <div className="error-box" style={{ marginTop: '12px' }}>Pro interní převod musí existovat alespoň dva hotovostní účty/pozice.</div>}
          {error && <div className="error-box" style={{ marginTop: '12px' }}>{error}</div>}
          {message && <div style={{ marginTop: '12px', color: '#416653', fontSize: '12px' }}>{message}</div>}
        </form>
      )}
    </section>
  )
}
