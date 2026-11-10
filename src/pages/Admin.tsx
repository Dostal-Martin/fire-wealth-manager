import { useState } from 'react'

import { importSnapshots } from '../services/importSnapshots'
import { importCashflow } from '../services/importCashflow'

export default function Admin() {
  const [message, setMessage] =
    useState('')

  async function handleImportHistory() {
    try {
      const count =
        await importSnapshots()

      setMessage(
        `✅ Importováno ${count} snapshotů`
      )
    } catch (error) {
      console.error(error)

      setMessage(
        '❌ Import historie selhal'
      )
    }
  }

  async function handleImportCashflow() {
    try {
      const count =
        await importCashflow()

      setMessage(
        `✅ Importováno ${count} transakcí`
      )
    } catch (error) {
      console.error(error)

      setMessage(
        '❌ Import cashflow selhal'
      )
    }
  }

  return (
    <div>
      <h1>⚙️ Správa dat</h1>

      <div
        style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={handleImportHistory}
          style={buttonStyle}
        >
          Import historie majetku
        </button>

        <button
          onClick={handleImportCashflow}
          style={buttonStyle}
        >
          Import cashflow
        </button>
      </div>

      <p
        style={{
          marginTop: '20px',
          fontWeight: 600,
        }}
      >
        {message}
      </p>
    </div>
  )
}

const buttonStyle = {
  padding: '12px 20px',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
}