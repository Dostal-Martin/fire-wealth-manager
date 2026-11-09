import { useEffect, useState } from 'react'

import {
  createPosition,
  getInstrumentsForPosition,
} from '../services/positionManager'

export default function PositionManager() {
  const [instruments, setInstruments] =
    useState<any[]>([])

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

  useEffect(() => {
    async function load() {
      const data =
        await getInstrumentsForPosition()

      setInstruments(data)

      if (data.length > 0) {
        setInstrumentId(data[0].id)
      }
    }

    load()
  }, [])

  async function handleSave() {
    try {
      await createPosition(
        instrumentId,
        Number(quantity),
        Number(cost),
        Number(value)
      )

      setMessage('✅ Pozice uložena')

      setQuantity('')
      setCost('')
      setValue('')
    } catch (error) {
      console.error(error)

      setMessage(
        '❌ Uložení selhalo'
      )
    }
  }

  return (
    <div>
      <h1>➕ Správa pozic</h1>

      <div
        style={{
          background: 'white',
          border: '1px solid #ddd',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '600px',
        }}
      >
        <div>
          <label>Instrument</label>

          <select
            value={instrumentId}
            onChange={(e) =>
              setInstrumentId(
                e.target.value
              )
            }
            style={{
              width: '100%',
              padding: '10px',
              marginTop: '5px',
            }}
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
        </div>

        <div
          style={{ marginTop: '15px' }}
        >
          <label>Počet ks</label>

          <input
            value={quantity}
            onChange={(e) =>
              setQuantity(
                e.target.value
              )
            }
            style={{
              width: '100%',
              padding: '10px',
            }}
          />
        </div>

        <div
          style={{ marginTop: '15px' }}
        >
          <label>Náklady</label>

          <input
            value={cost}
            onChange={(e) =>
              setCost(
                e.target.value
              )
            }
            style={{
              width: '100%',
              padding: '10px',
            }}
          />
        </div>

        <div
          style={{ marginTop: '15px' }}
        >
          <label>
            Aktuální hodnota
          </label>

          <input
            value={value}
            onChange={(e) =>
              setValue(
                e.target.value
              )
            }
            style={{
              width: '100%',
              padding: '10px',
            }}
          />
        </div>

        <button
          onClick={handleSave}
          style={{
            marginTop: '20px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Uložit pozici
        </button>

        <p
          style={{
            marginTop: '15px',
          }}
        >
          {message}
        </p>
      </div>
    </div>
  )
}