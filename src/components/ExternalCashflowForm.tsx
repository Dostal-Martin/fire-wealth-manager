import { useState } from 'react'
import {
  getStoredExternalCashflowAmount,
  type ExternalCashflowInput,
} from '../domain/externalCashflow'
import { createExternalCashflow } from '../services/externalCashflow'

function getLocalDate() {
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

export default function ExternalCashflowForm({
  onSaved,
}: {
  onSaved?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<ExternalCashflowInput>({
    transactionDate: getLocalDate(),
    transactionType: 'DEPOSIT',
    amountCzk: 0,
    note: '',
  })

  const storedAmount = getStoredExternalCashflowAmount(
    form.transactionType,
    form.amountCzk,
  )

  async function submit(event: React.FormEvent) {
    event.preventDefault()

    try {
      setSaving(true)
      setError('')
      setMessage('')

      await createExternalCashflow(form)

      setMessage(
        form.transactionType === 'DEPOSIT'
          ? 'Vklad byl uložen.'
          : 'Výběr byl uložen.',
      )

      setForm((current) => ({
        ...current,
        amountCzk: 0,
        note: '',
      }))

      onSaved?.()
    } catch (reason) {
      console.error('Uložení externího cashflow:', reason)
      setError(
        reason instanceof Error
          ? reason.message
          : 'Cashflow se nepodařilo uložit.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel" style={{ marginBottom: '18px' }}>
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Vklad nebo výběr</h2>
          <div className="panel-subtitle">
            Externí pohyb kapitálu pro výpočet XIRR a TWR. Přesuny mezi evidovanými účty sem nepatří.
          </div>
        </div>

        <button
          className="button-secondary"
          type="button"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Zavřít formulář' : 'Přidat vklad / výběr'}
        </button>
      </div>

      {expanded && (
        <form className="panel-body" onSubmit={submit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '12px',
            }}
          >
            <label>
              <span className="form-label">Typ</span>
              <select
                className="form-control"
                value={form.transactionType}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  transactionType: event.target.value as 'DEPOSIT' | 'WITHDRAWAL',
                }))}
              >
                <option value="DEPOSIT">Vklad</option>
                <option value="WITHDRAWAL">Výběr</option>
              </select>
            </label>

            <label>
              <span className="form-label">Datum</span>
              <input
                className="form-control"
                type="date"
                required
                value={form.transactionDate}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  transactionDate: event.target.value,
                }))}
              />
            </label>

            <label>
              <span className="form-label">Částka v CZK</span>
              <input
                className="form-control"
                inputMode="decimal"
                required
                value={form.amountCzk || ''}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  amountCzk: parseNumber(event.target.value),
                }))}
                placeholder="100000"
              />
            </label>
          </div>

          <div style={{ marginTop: '12px' }}>
            <label>
              <span className="form-label">Poznámka</span>
              <input
                className="form-control"
                value={form.note}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))}
                placeholder="Například nový kapitál z příjmu"
              />
            </label>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              marginTop: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Do databáze se uloží:{' '}
              <strong>
                {storedAmount.toLocaleString('cs-CZ', {
                  style: 'currency',
                  currency: 'CZK',
                })}
              </strong>
              <br />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Vklad je kladný tok, výběr záporný tok. Oba mají is_external = true.
              </span>
            </div>

            <button
              className="button-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Ukládám...' : 'Uložit cashflow'}
            </button>
          </div>

          {error && (
            <div className="error-box" style={{ marginTop: '12px' }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{ marginTop: '12px', color: '#416653', fontSize: '12px' }}>
              {message}
            </div>
          )}
        </form>
      )}
    </section>
  )
}
