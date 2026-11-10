import { useEffect, useState } from 'react'

import {
  createPosition,
  updatePosition,
  deletePosition,
  getPositions,
  getInstrumentsForPosition,
} from '../services/positionManager'

export default function PositionManager() {
  const [positions, setPositions] =
    useState<any[]>([])

  const [instruments, setInstruments] =
    useState<any[]>([])

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [search, setSearch] =
    useState('')

  const [instrumentId, setInstrumentId] =
    useState('')

  const [quantity, setQuantity] =
    useState('')

  const [cost, setCost] =
    useState('')

  const [value, setValue] =
    useState('')

  const [message, setMessage] =
    useState('')

  async function load() {
    const positionData =
      await getPositions()

    const instrumentData =
      await getInstrumentsForPosition()

    setPositions(positionData)

    setInstruments(instrumentData)

    if (
      instrumentData.length > 0 &&
      !instrumentId
    ) {
      setInstrumentId(
        instrumentData[0].id
      )
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSave() {
    try {
      if (editingId) {
        await updatePosition(
          editingId,
          instrumentId,
          Number(quantity),
          Number(cost),
          Number(value)
        )

        setMessage(
          '✅ Pozice upravena'
        )
      } else {
        await createPosition(
          instrumentId,
          Number(quantity),
          Number(cost),
          Number(value)
        )

        setMessage(
          '✅ Pozice vytvořena'
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
        'Opravdu smazat pozici?'
      )
    ) {
      return
    }

    await deletePosition(id)

    await load()
  }

  function handleEdit(
    position: any
  ) {
    setEditingId(position.id)

    setInstrumentId(
      position.instrument_id
    )

    setQuantity(
      String(position.quantity)
    )

    setCost(
      String(position.total_cost)
    )

    setValue(
      String(position.current_value)
    )
  }

  function resetForm() {
    setEditingId(null)

    setQuantity('')
    setCost('')
    setValue('')
  }

  const filtered =
    positions.filter(
      (position) =>
        position.instruments?.name
          ?.toLowerCase()
          .includes(
            search.toLowerCase()
          )
    )

  return (
    <div>
      <h1>➕ Správa pozic</h1>

      <div
        style={{
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
        }}
      >
        <select
          value={instrumentId}
          onChange={(e) =>
            setInstrumentId(
              e.target.value
            )
          }
          style={inputStyle}
        >
          {instruments.map(
            (instrument) => (
              <option
                key={instrument.id}
                value={instrument.id}
              >
                {instrument.name}
              </option>
            )
          )}
        </select>

        <input
          placeholder="Počet ks"
          value={quantity}
          onChange={(e) =>
            setQuantity(
              e.target.value
            )
          }
          style={inputStyle}
        />

        <input
          placeholder="Náklady"
          value={cost}
          onChange={(e) =>
            setCost(
              e.target.value
            )
          }
          style={inputStyle}
        />

        <input
          placeholder="Aktuální hodnota"
          value={value}
          onChange={(e) =>
            setValue(
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
            : 'Vytvořit pozici'}
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
        placeholder="Vyhledat pozici..."
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
            <th>Instrument</th>
            <th>Počet</th>
            <th>Náklady</th>
            <th>Hodnota</th>
            <th>Akce</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map(
            (position) => (
              <tr
                key={position.id}
              >
                <td>
                  {
                    position
                      .instruments
                      ?.name
                  }
                </td>

                <td>
                  {position.quantity}
                </td>

                <td>
                  {Math.round(
                    Number(
                      position.total_cost
                    )
                  ).toLocaleString(
                    'cs-CZ'
                  )}
                </td>

                <td>
                  {Math.round(
                    Number(
                      position.current_value
                    )
                  ).toLocaleString(
                    'cs-CZ'
                  )}
                </td>

                <td>
                  <button
                    onClick={() =>
                      handleEdit(
                        position
                      )
                    }
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() =>
                      handleDelete(
                        position.id
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