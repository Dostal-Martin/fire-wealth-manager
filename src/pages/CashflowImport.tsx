import { getCashflowRows } from '../services/importCashflow'

export default function CashflowImport() {
  const rows = getCashflowRows()

  return (
    <div>
      <h1>📥 Import Cashflow</h1>

      <p>
        Načteno transakcí:
        {' '}
        {rows.length}
      </p>
    </div>
  )
}