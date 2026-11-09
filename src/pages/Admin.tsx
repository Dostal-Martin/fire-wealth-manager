import { useState } from 'react'

import { importSnapshots } from '../services/importSnapshots'

export default function Admin() {
  const [message, setMessage] =
    useState('')

  async function handleImport() {
    try {
      const count =
        await importSnapshots()

      setMessage(
        `✅ Importováno ${count} záznamů historie`
      )
    } catch (error) {
      console.error(error)

      setMessage(
        '❌ Import selhal'
      )
    }
  }

  return (
    <div>
      <h1>⚙️ Správa dat</h1>

      <div
        style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          maxWidth: '500px',
        }}
      >
        <h2>Historie majetku</h2>

        <p>
          Nahraje historii majetku z
          fireData.json do tabulky
          portfolio_snapshots.
        </p>

        <button
          onClick={handleImport}
          style={{
            padding:
              '12px 20px',
            background:
              '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Import historie majetku
        </button>

        <p
          style={{
            marginTop: '20px',
            fontWeight: 600,
          }}
        >
          {message}
        </p>
      </div>
    </div>
  )
}