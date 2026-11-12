import { useEffect, useMemo, useState } from 'react'
import DecimalInput from './DecimalInput'
import {
  validateManualTransaction,
  type ManualTransactionInput,
} from '../domain/transactionEntry'
import {
  createManualTransaction,
  getSettlementAccounts,
  getTradableInstruments,
  type SettlementAccount,
  type TradableInstrument,
} from '../services/transactionEntry'

function localDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


function formatMoney(value: number) {
  return value.toLocaleString('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  })
}

function accountLabel(account: SettlementAccount) {
  return `${account.name}${account.ticker ? ` · ${account.ticker}` : ''} · ${account.currency}`
}

export default function ManualTransactionForm({ onSaved }: { onSaved: () => void }) {
  const [instruments, setInstruments] = useState<TradableInstrument[]>([])
  const [accounts, setAccounts] = useState<SettlementAccount[]>([])
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState<ManualTransactionInput>({
    instrumentId: '',
    cashInstrumentId: '',
    transactionDate: localDate(),
    transactionType: 'BUY',
    quantity: 0,
    unitPrice: 0,
    currency: 'CZK',
    fxRate: 1,
    feesNative: 0,
    taxNative: 0,
    note: '',
  })

  useEffect(() => {
    Promise.all([getTradableInstruments(), getSettlementAccounts()])
      .then(([loadedInstruments, loadedAccounts]) => {
        setInstruments(loadedInstruments)
        setAccounts(loadedAccounts)
      })
      .catch((reason) => {
        console.error('Načtení transakčního formuláře:', reason)
        setError('Instrumenty nebo hotovostní účty se nepodařilo načíst.')
      })
  }, [])

  const matchingAccounts = useMemo(
    () => accounts.filter((account) => account.currency === form.currency),
    [accounts, form.currency],
  )

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === form.cashInstrumentId) ?? null,
    [accounts, form.cashInstrumentId],
  )

  const amount = useMemo(() => validateManualTransaction(form), [form])

  function update<K extends keyof ManualTransactionInput>(key: K, value: ManualTransactionInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function selectInstrument(instrumentId: string) {
    const instrument = instruments.find((item) => item.id === instrumentId)
    const currency = instrument?.currency ?? 'CZK'
    const account = accounts.find((item) => item.currency === currency)

    setForm((current) => ({
      ...current,
      instrumentId,
      currency,
      fxRate: currency === 'CZK' ? 1 : current.fxRate,
      cashInstrumentId: account?.id ?? '',
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setMessage('')
      const result = await createManualTransaction(form)
      setMessage(
        result.transactionType === 'BUY'
          ? `Nákup byl uložen. Z vypořádacího účtu bylo odečteno ${result.netNative.toLocaleString('cs-CZ', { maximumFractionDigits: 4 })} ${form.currency}.`
          : `Prodej byl uložen. Na vypořádací účet bylo připsáno ${result.netNative.toLocaleString('cs-CZ', { maximumFractionDigits: 4 })} ${form.currency}.`,
      )
      setForm((current) => ({
        ...current,
        quantity: 0,
        unitPrice: 0,
        feesNative: 0,
        taxNative: 0,
        note: '',
      }))
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
          <div className="panel-subtitle">
            Obchod se atomicky propíše do transakčního deníku, investiční pozice, vypořádací hotovosti a dnešního snapshotu.
          </div>
        </div>
        <button className="button-secondary" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Zavřít formulář' : 'Přidat transakci'}
        </button>
      </div>

      {expanded && (
        <form className="panel-body" onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <Field label="Typ">
              <select className="form-control" value={form.transactionType} onChange={(event) => update('transactionType', event.target.value as 'BUY' | 'SELL')}>
                <option value="BUY">Nákup</option>
                <option value="SELL">Prodej</option>
              </select>
            </Field>

            <Field label="Instrument">
              <select className="form-control" required value={form.instrumentId} onChange={(event) => selectInstrument(event.target.value)}>
                <option value="">Vyberte instrument</option>
                {instruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name}{instrument.ticker ? ` (${instrument.ticker})` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={form.transactionType === 'BUY' ? 'Zaplatit z účtu' : 'Připsat na účet'}>
              <select className="form-control" required value={form.cashInstrumentId} onChange={(event) => update('cashInstrumentId', event.target.value)}>
                <option value="">Vyberte účet</option>
                {matchingAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{accountLabel(account)}</option>
                ))}
              </select>
              {form.instrumentId && matchingAccounts.length === 0 && (
                <div style={{ marginTop: '4px', color: '#8b4444', fontSize: '10px' }}>
                  Pro měnu {form.currency} není evidovaný hotovostní účet.
                </div>
              )}
              {selectedAccount && (
                <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '10px' }}>
                  Zůstatek: {selectedAccount.quantity.toLocaleString('cs-CZ', { maximumFractionDigits: 4 })} {selectedAccount.currency} · {formatMoney(selectedAccount.currentValueCzk)}
                </div>
              )}
            </Field>

            <Field label="Datum">
              <input className="form-control" type="date" required value={form.transactionDate} onChange={(event) => update('transactionDate', event.target.value)} />
            </Field>

            <Field label="Množství">
              <DecimalInput value={form.quantity} onValueChange={(value) => update('quantity', value)} required decimalPlaces={6} />
            </Field>

            <Field label={`Cena za jednotku (${form.currency})`}>
              <DecimalInput value={form.unitPrice} onValueChange={(value) => update('unitPrice', value)} required decimalPlaces={6} />
            </Field>

            <Field label="Měna">
              <input className="form-control" value={form.currency} readOnly />
            </Field>

            <Field label="FX kurz do CZK">
              <DecimalInput value={form.fxRate} onValueChange={(value) => update('fxRate', value)} required readOnly={form.currency === 'CZK'} decimalPlaces={6} />
            </Field>

            <Field label={`Poplatek (${form.currency})`}>
              <DecimalInput value={form.feesNative} onValueChange={(value) => update('feesNative', value)} decimalPlaces={4} />
            </Field>

            <Field label={`Daň (${form.currency})`}>
              <DecimalInput value={form.taxNative} onValueChange={(value) => update('taxNative', value)} decimalPlaces={4} />
            </Field>
          </div>

          <div style={{ marginTop: '12px' }}>
            <Field label="Poznámka">
              <input className="form-control" value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Volitelná poznámka" />
            </Field>
          </div>

          <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <Summary label="Hrubá hodnota" value={`${amount.grossNative.toLocaleString('cs-CZ', { maximumFractionDigits: 4 })} ${form.currency}`} />
            <Summary label={form.transactionType === 'BUY' ? 'Odečte se z účtu' : 'Připíše se na účet'} value={`${amount.netNative.toLocaleString('cs-CZ', { maximumFractionDigits: 4 })} ${form.currency}`} />
            <Summary label="Korunová hodnota" value={formatMoney(amount.amountCzk)} />
          </div>

          <div style={{ marginTop: '10px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5 }}>
            BUY používá cenu, poplatek a daň v měně instrumentu a odečítá čisté vypořádání ze zvoleného hotovostního účtu stejné měny. SELL připisuje čistý výnos na zvolený účet. Nákladová báze zůstává vedena v CZK.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="button-primary" type="submit" disabled={saving || !form.cashInstrumentId}>
              {saving ? 'Ukládám...' : form.transactionType === 'BUY' ? 'Uložit nákup' : 'Uložit prodej'}
            </button>
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  )
}
