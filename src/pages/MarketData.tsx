import { useEffect, useState } from 'react'

import {
  updateMarketPrices,
  type PriceUpdateResult,
} from '../services/priceUpdater'

import { supabase } from '../lib/supabase'

type Props = {
  onPricesUpdated?: () => void
}

type MarketRow = {
  id: string
  name: string
  ticker: string
  currency: string
  closePrice: number | null
  priceDate: string | null
}

export default function MarketData({
  onPricesUpdated,
}: Props) {
  const [rows, setRows] =
    useState<MarketRow[]>([])

  const [loading, setLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [result, setResult] =
    useState<PriceUpdateResult | null>(
      null
    )

  async function loadMarketData() {
    const {
      data: instruments,
      error: instrumentError,
    } = await supabase
      .from('instruments')
      .select(
        'id,name,ticker,currency'
      )
      .eq(
        'pricing_source',
        'yahoo'
      )
      .not(
        'ticker',
        'is',
        null
      )
      .order('ticker')

    if (instrumentError) {
      throw instrumentError
    }

    const output: MarketRow[] = []

    for (
      const instrument of
      instruments ?? []
    ) {
      const {
        data: prices,
        error: priceError,
      } = await supabase
        .from('price_history')
        .select(
          'close_price,price_date'
        )
        .eq(
          'instrument_id',
          instrument.id
        )
        .order(
          'price_date',
          {
            ascending: false,
          }
        )
        .limit(1)

      if (priceError) {
        throw priceError
      }

      const latest =
        prices?.[0]

      output.push({
        id:
          instrument.id,

        name:
          instrument.name,

        ticker:
          instrument.ticker ?? '',

        currency:
          instrument.currency ?? '',

        closePrice:
          latest
            ? Number(
                latest.close_price
              )
            : null,

        priceDate:
          latest?.price_date ??
          null,
      })
    }

    setRows(output)
  }

  useEffect(() => {
    loadMarketData()
  }, [])

  async function handleUpdate() {
    try {
      setLoading(true)
      setMessage(
        'Aktualizuji tržní ceny...'
      )

      const updateResult =
        await updateMarketPrices()

      setResult(updateResult)

      await loadMarketData()

      if (
        updateResult.errorCount === 0
      ) {
        setMessage(
          `✅ Aktualizováno ${updateResult.updatedCount} z ${updateResult.processed} instrumentů`
        )
      } else {
        setMessage(
          `⚠️ Aktualizováno ${updateResult.updatedCount} z ${updateResult.processed}. Chyb: ${updateResult.errorCount}`
        )
      }

      onPricesUpdated?.()
    } catch (error) {
      console.error(error)

      setMessage(
        '❌ Aktualizace cen selhala'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>📊 Tržní data</h1>

      <button
        onClick={handleUpdate}
        disabled={loading}
        style={{
          padding: '12px 20px',
          background:
            loading
              ? '#94a3b8'
              : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor:
            loading
              ? 'default'
              : 'pointer',
          marginBottom: '15px',
        }}
      >
        {loading
          ? 'Aktualizuji...'
          : '🔄 Aktualizovat ceny'}
      </button>

      <p
        style={{
          fontWeight: 600,
        }}
      >
        {message}
      </p>

      {result?.fx && (
        <div
          style={{
            display: 'flex',
            gap: '30px',
            margin:
              '20px 0',
          }}
        >
          <div>
            <strong>
              USD/CZK
            </strong>

            <div>
              {result.fx.USDCZK
                .toFixed(4)}
            </div>
          </div>

          <div>
            <strong>
              EUR/CZK
            </strong>

            <div>
              {result.fx.EURCZK
                .toFixed(4)}
            </div>
          </div>

          <div>
            <strong>
              Datum FX
            </strong>

            <div>
              {result.fx.date}
            </div>
          </div>
        </div>
      )}

      <table
        style={{
          width: '100%',
          background: 'white',
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Název</th>
            <th>Měna</th>
            <th>Poslední cena</th>
            <th>Datum</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row) => (
              <tr
                key={row.id}
                style={{
                  borderBottom:
                    '1px solid #e5e7eb',
                }}
              >
                <td>
                  {row.ticker}
                </td>

                <td>
                  {row.name}
                </td>

                <td>
                  {row.currency}
                </td>

                <td>
                  {row.closePrice !==
                  null
                    ? row.closePrice.toLocaleString(
                        'cs-CZ',
                        {
                          maximumFractionDigits:
                            4,
                        }
                      )
                    : '-'}
                </td>

                <td>
                  {row.priceDate ??
                    '-'}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>

      {result &&
        result.errors.length >
          0 && (
          <div
            style={{
              marginTop: '30px',
              color: '#dc2626',
            }}
          >
            <h3>
              Chyby aktualizace
            </h3>

            {result.errors.map(
              (error) => (
                <div
                  key={
                    error.ticker
                  }
                >
                  {error.ticker}
                  {' - '}
                  {error.error}
                </div>
              )
            )}
          </div>
        )}
    </div>
  )
}