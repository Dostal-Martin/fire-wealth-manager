import { useEffect, useState } from 'react'

import {
  getInstruments,
  createInstrument,
  updateInstrument,
  deleteInstrument,
} from '../services/instrumentManager'

export default function InstrumentManager() {
  const [instruments, setInstruments] =
    useState<any[]>([])

  const [search, setSearch] =
    useState('')

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [name, setName] =
    useState('')

  const [ticker, setTicker] =
    useState('')

  const [assetType, setAssetType] =
    useState('Akcie')

  const [currency, setCurrency] =
    useState('CZK')

  const [message, setMessage] =
    useState('')

  async function load() {
    const data =
      await getInstruments()

    setInstruments(data)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSave() {
    try {
      if (editingId) {
        await updateInstrument(
          editingId,
          name,
          ticker,
          assetType,
          currency
        )

        setMessage(
          '✅ Instrument upraven'
        )
      } else {
        await createInstrument(
          name,
          ticker,
          assetType,
          currency
        )

        setMessage(
          '✅ Instrument vytvořen'
        )
      }

      resetForm()

      await load()
    } catch (error) {
      console.error(error)

      setMessage(
        '❌ Operace selhala'
      )
    }
  }

  async function handleDelete(
    id: string
  ) {
    if (
      !confirm(
        'Opravdu smazat instrument?'
      )
    ) {
      return
    }

    await deleteInstrument(id)

    await load()
  }

  function handleEdit(
    instrument: any
  ) {
    setEditingId(instrument.id)

    setName(instrument.name)

    setTicker(
      instrument.ticker ?? ''
    )

    setAssetType(
      instrument.asset_type
    )

    setCurrency(
      instrument.currency
    )
  }

  function resetForm() {
    setEditingId(null)

    setName('')
    setTicker('')
    setAssetType('Akcie')
    setCurrency('CZK')
  }

  const filtered =
    instruments.filter(
      (item) =>
        item.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        (item.ticker ?? '')
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    )

  return (
    <div>
      <h1>
        🏷️ Správa instrumentů
      </h1>

      <div
        style={{
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <input
          placeholder="Název"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          style={inputStyle}
        />

        <input
          placeholder="Ticker"
          value={ticker}
          onChange={(e) =>
            setTicker(
              e.target.value
            )
          }
          style={inputStyle}
        />

        <input
          placeholder="Typ"
          value={assetType}
          onChange={(e) =>
            setAssetType(
              e.target.value
            )
          }
          style={inputStyle}
        />

        <input
          placeholder="Měna"
          value={currency}
          onChange={(e) =>
            setCurrency(
              e.target.value
            )
          }
          style={inputStyle}
        />

        <button
          onClick={handleSave}
          style={primaryButton}
        >
          {editingId
            ? 'Uložit změny'
            : 'Vytvořit instrument'}
        </button>

        <button
          onClick={resetForm}
          style={{
            ...primaryButton,
            background: '#64748b',
            marginLeft: '10px',
          }}
        >
          Zrušit
        </button>

        <p>{message}</p>
      </div>

      <input
        placeholder="Vyhledat..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
        style={{
          ...inputStyle,
          marginBottom: '20px',
        }}
      />

      <table
        style={{
          width: '100%',
          background: 'white',
        }}
      >
        <thead>
          <tr>
            <th>Název</th>
            <th>Ticker</th>
            <th>Typ</th>
            <th>Měna</th>
            <th>Akce</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map(
            (instrument) => (
              <tr
                key={instrument.id}
              >
                <td>
                  {instrument.name}
                </td>

                <td>
                  {
                    instrument.ticker
                  }
                </td>

                <td>
                  {
                    instrument.asset_type
                  }
                </td>

                <td>
                  {
                    instrument.currency
                  }
                </td>

                <td>
                  <button
                    onClick={() =>
                      handleEdit(
                        instrument
                      )
                    }
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() =>
                      handleDelete(
                        instrument.id
                      )
                    }
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  marginBottom: '10px',
}

const primaryButton = {
  padding: '12px 20px',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
}