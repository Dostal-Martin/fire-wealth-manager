import {
  useEffect,
  useState,
} from 'react'

import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import PositionManager from './pages/PositionManager'
import InstrumentManager from './pages/InstrumentManager'
import Cashflow from './pages/Cashflow'
import Income from './pages/Income'
import MarketData from './pages/MarketData'
import PriceHistory from './pages/PriceHistory'
import NetWorth from './pages/NetWorth'
import Fire from './pages/Fire'
import Admin from './pages/Admin'

import {
  markPricesUpdatedToday,
  pricesUpdatedToday,
  updateMarketPrices,
} from './services/priceUpdater'

function App() {
  const [page, setPage] =
    useState('dashboard')

  const [
    priceRefreshVersion,
    setPriceRefreshVersion,
  ] = useState(0)

  const [
    automaticUpdateMessage,
    setAutomaticUpdateMessage,
  ] = useState('')

  useEffect(() => {
    let cancelled = false

    async function updatePricesOncePerDay() {
      if (
        pricesUpdatedToday()
      ) {
        return
      }

      try {
        setAutomaticUpdateMessage(
          'Aktualizuji tržní ceny...'
        )

        const result =
          await updateMarketPrices()

        if (cancelled) {
          return
        }

        if (
          result.updatedCount > 0
        ) {
          markPricesUpdatedToday()

          setPriceRefreshVersion(
            (value) =>
              value + 1
          )
        }

        if (
          result.errorCount === 0
        ) {
          setAutomaticUpdateMessage(
            `Ceny aktualizovány: ${result.updatedCount}/${result.processed}`
          )
        } else {
          setAutomaticUpdateMessage(
            `Ceny: ${result.updatedCount}/${result.processed}, chyby: ${result.errorCount}`
          )
        }
      } catch (error) {
        console.error(
          'Automatická aktualizace cen:',
          error
        )

        if (!cancelled) {
          setAutomaticUpdateMessage(
            'Automatická aktualizace cen se nezdařila'
          )
        }
      }
    }

    updatePricesOncePerDay()

    return () => {
      cancelled = true
    }
  }, [])

  function pricesUpdated() {
    markPricesUpdatedToday()

    setPriceRefreshVersion(
      (value) =>
        value + 1
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor:
          '#f8fafc',
      }}
    >
      <aside
        style={{
          width: '260px',
          backgroundColor:
            '#0f172a',
          color: 'white',
          padding: '20px',
        }}
      >
        <h2>FIRE WM</h2>

        <div
          style={{
            marginTop: '30px',
            display: 'flex',
            flexDirection:
              'column',
            gap: '12px',
          }}
        >
          <button
            onClick={() =>
              setPage(
                'dashboard'
              )
            }
            style={
              menuButtonStyle
            }
          >
            🏠 Dashboard
          </button>

          <button
            onClick={() =>
              setPage(
                'portfolio'
              )
            }
            style={
              menuButtonStyle
            }
          >
            💼 Portfolio
          </button>

          <button
            onClick={() =>
              setPage(
                'positions'
              )
            }
            style={
              menuButtonStyle
            }
          >
            ➕ Správa pozic
          </button>

          <button
            onClick={() =>
              setPage(
                'instruments'
              )
            }
            style={
              menuButtonStyle
            }
          >
            🏷️ Správa instrumentů
          </button>

          <button
            onClick={() =>
              setPage(
                'cashflow'
              )
            }
            style={
              menuButtonStyle
            }
          >
            💰 Cashflow
          </button>

          <button
            onClick={() =>
              setPage(
                'income'
              )
            }
            style={
              menuButtonStyle
            }
          >
            📈 Příjmy
          </button>

          <button
            onClick={() =>
              setPage(
                'market'
              )
            }
            style={
              menuButtonStyle
            }
          >
            📊 Tržní data
          </button>

          <button
            onClick={() =>
              setPage(
                'prices'
              )
            }
            style={
              menuButtonStyle
            }
          >
            📉 Historie cen
          </button>

          <button
            onClick={() =>
              setPage(
                'networth'
              )
            }
            style={
              menuButtonStyle
            }
          >
            📈 Vývoj majetku
          </button>

          <button
            onClick={() =>
              setPage('fire')
            }
            style={
              menuButtonStyle
            }
          >
            🔥 FIRE
          </button>

          <button
            onClick={() =>
              setPage(
                'admin'
              )
            }
            style={
              menuButtonStyle
            }
          >
            ⚙️ Správa dat
          </button>
        </div>

        {automaticUpdateMessage && (
          <div
            style={{
              marginTop:
                '25px',
              fontSize:
                '12px',
              lineHeight:
                1.4,
              color:
                '#cbd5e1',
            }}
          >
            {
              automaticUpdateMessage
            }
          </div>
        )}
      </aside>

      <main
        style={{
          flex: 1,
          padding: '40px',
        }}
      >
        {page ===
          'dashboard' && (
          <Dashboard
            key={
              priceRefreshVersion
            }
          />
        )}

        {page ===
          'portfolio' && (
          <Portfolio
            key={
              priceRefreshVersion
            }
          />
        )}

        {page ===
          'positions' && (
          <PositionManager />
        )}

        {page ===
          'instruments' && (
          <InstrumentManager />
        )}

        {page ===
          'cashflow' && (
          <Cashflow />
        )}

        {page ===
          'income' && (
          <Income />
        )}

        {page ===
          'market' && (
          <MarketData
            onPricesUpdated={
              pricesUpdated
            }
          />
        )}

        {page ===
          'prices' && (
          <PriceHistory
            key={
              priceRefreshVersion
            }
          />
        )}

        {page ===
          'networth' && (
          <NetWorth />
        )}

        {page === 'fire' && (
          <Fire />
        )}

        {page ===
          'admin' && (
          <Admin />
        )}
      </main>
    </div>
  )
}

const menuButtonStyle = {
  background:
    'transparent',

  border:
    '1px solid rgba(255,255,255,0.10)',

  color:
    'white',

  textAlign:
    'left' as const,

  padding:
    '12px',

  cursor:
    'pointer',

  fontSize:
    '16px',

  borderRadius:
    '8px',
}

export default App