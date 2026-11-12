import { useEffect, useMemo, useState } from 'react'
import {
  createExternalCashflow,
  getExternalCashAccounts,
  type ExternalCashAccount,
} from '../services/externalCashflow'
import type {
  ExternalCashflowInput,
  ExternalCashflowType,
} from '../domain/externalCashflow'

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(/\s/g, '').replace(',', '.').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function accountLabel(account: ExternalCashAccount) {
  return `${account.name}${account.ticker ? ` · ${account.ticker}` : ''} · ${account.currency}`
}

export default function ExternalCashflowForm({ onSaved }: { onSaved?: () => void }) {
  const [accounts, setAccounts] = useState<ExternalCashAccount[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<ExternalCashflowInput>({
    cashInstrumentId: '',
    transactionDate: localDate(),
    transactionType: 'DEPOSIT',
    amountNative: 0,
    currency: 'CZK',
    fxRate: 1,
    note: '',
  })

  useEffect(() => {
    getExternalCashAccounts()
      .then((loaded) => {
        setAccounts(loaded)
        const preferred = loaded.find((item) => item.ticker === 'CASH.CZK') ?? loaded[0]
        if (preferred) {
          setForm((current) => ({
            ...current,
            cashInstrumentId: preferred.id,
            currency: preferred.currency,
            fxRate: preferred.currency === 'CZK' ? 1 : current.fxRate,
          }))
        }
      })
      .catch((reason) => {
        console.error('Externí cashflow účty:', reason)
        setError('Hotovostní účty se nepodařilo načíst.')
      })
  }, [])

  const selectedAccount = useMemo(
    () => accounts.find((item) => item.id === form.cashInstrumentId) ?? null,
    [accounts, form.cashInstrumentId],
  )

  const amountCzk = form.amountNative * form.fxRate

  function selectAccount(id: string) {
    const account = accounts.find((item) => item.id === id)
    setForm((current) => ({
      ...current,
      cashInstrumentId: id,
      currency: account?.currency ?? 'CZK',
      fxRate: account?.currency === 'CZK' ? 1 : current.fxRate,
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setMessage('')
      await createExternalCashflow(form)
      setMessage(form.transactionType === 'DEPOSIT' ? 'Vklad byl uložen.' : 'Výběr byl uložen.')
      setForm((current) => ({ ...current, amountNative: 0, note: '' }))
      onSaved?.()
    } catch (reason) {
      console.error('Externí cashflow:', reason)
      setError(reason instanceof Error ? reason.message : 'Externí cashflow se nepodařilo uložit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Externí kapitál</h2>
          <div className="panel-subtitle">
            Vklad přidává nový kapitál do FIRE WM, výběr jej odvádí ven. Oba pohyby vstupují do XIRR/TWR.
          </div>
        </div>
        <button className="button-secondary" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Zavřít formulář' : 'Přidat vklad / výběr'}
        </button>
      </div>

      {expanded && (
        <form className="panel-body" onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <label>
              <span className="form-label">Typ</span>
              <select className="form-control" value={form.transactionType} onChange={(event) => setForm((current) => ({ ...current, transactionType: event.target.value as ExternalCashflowType }))}>
                <option value="DEPOSIT">Vklad</option>
                <option value="WITHDRAWAL">Výběr</option>
              </select>
            </label>

            <label>
              <span className="form-label">{form.transactionType === 'DEPOSIT' ? 'Na účet' : 'Z účtu'}</span>
              <select className="form-control" required value={form.cashInstrumentId} onChange={(event) => selectAccount(event.target.value)}>
                <option value="">Vyberte účet</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
              </select>
              {selectedAccount && (
                <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '10px' }}>
                  Zůstatek: {selectedAccount.quantity.toLocaleString('cs-CZ', { maximumFractionDigits: 4 })} {selectedAccount.currency}
                </div>
              )}
            </label>

            <label>
              <span className="form-label">Datum</span>
              <input className="form-control" type="date" required value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
            </label>

            <label>
              <span className="form-label">Částka ({form.currency})</span>
              <input className="form-control" inputMode="decimal" required value={form.amountNative || ''} onChange={(event) => setForm((current) => ({ ...current, amountNative: parseNumber(event.target.value) }))} />
            </label>

            <label>
              <span className="form-label">Měna</span>
              <input className="form-control" value={form.currency} readOnly />
            </label>

            <label>
              <span className="form-label">FX kurz do CZK</span>
              <input className="form-control" inputMode="decimal" required readOnly={form.currency === 'CZK'} value={form.fxRate || ''} onChange={(event) => setForm((current) => ({ ...current, fxRate: parseNumber(event.target.value) }))} />
            </label>
          </div>

          <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <div className="kpi-card">
              <div className="kpi-label">Částka v CZK</div>
              <div className="kpi-value">{amountCzk.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 })}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Dopad na Net Worth</div>
              <div className={`kpi-value ${form.transactionType === 'DEPOSIT' ? 'positive' : 'negative'}`}>
                {`${form.transactionType === 'DEPOSIT' ? '+' : '-'}${amountCzk.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 })}`}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <label>
              <span className="form-label">Poznámka</span>
              <input className="form-control" value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Volitelná poznámka" />
            </label>
          </div>

          <div style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5 }}>
            Převod mezi dvěma účty uvnitř FIRE WM sem nepatří. Pro takový pohyb použijte Interní převod.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="button-primary" type="submit" disabled={saving || !form.cashInstrumentId}>
              {saving ? 'Ukládám...' : form.transactionType === 'DEPOSIT' ? 'Uložit vklad' : 'Uložit výběr'}
            </button>
          </div>

          {error && <div className="error-box" style={{ marginTop: '12px' }}>{error}</div>}
          {message && <div style={{ marginTop: '12px', color: '#416653', fontSize: '12px' }}>{message}</div>}
        </form>
      )}
    </section>
  )
}
