import { useState } from 'react'

import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import PositionManager from './pages/PositionManager'
import InstrumentManager from './pages/InstrumentManager'
import MarketData from './pages/MarketData'
import NetWorth from './pages/NetWorth'
import Fire from './pages/Fire'
import Admin from './pages/Admin'

function App() {
  const [page, setPage] =
    useState('dashboard')

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
      }}
    >
      <aside
        style={{
          width: '260px',
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '20px',
        }}
      >
        <h2>FIRE WM</h2>

        <div
          style={{
            marginTop: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <button
            onClick={() =>
              setPage('dashboard')
            }
            style={menuButtonStyle}
          >
            🏠 Dashboard
          </button>

          <button
            onClick={() =>
              setPage('portfolio')
            }
            style={menuButtonStyle}
          >
            💼 Portfolio
          </button>

          <button
            onClick={() =>
              setPage('positions')
            }
            style={menuButtonStyle}
          >
            ➕ Správa pozic
          </button>

          <button
            onClick={() =>
              setPage('instruments')
            }
            style={menuButtonStyle}
          >
            🏷️ Správa instrumentů
          </button>

          <button
            onClick={() =>
              setPage('market')
            }
            style={menuButtonStyle}
          >
            📊 Tržní data
          </button>

          <button
            onClick={() =>
              setPage('networth')
            }
            style={menuButtonStyle}
          >
            📈 Vývoj majetku
          </button>

          <button
            onClick={() =>
              setPage('fire')
            }
            style={menuButtonStyle}
          >
            🔥 FIRE
          </button>

          <button
            onClick={() =>
              setPage('admin')
            }
            style={menuButtonStyle}
          >
            ⚙️ Správa dat
          </button>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          padding: '40px',
        }}
      >
        {page === 'dashboard' && (
          <Dashboard />
        )}

        {page === 'portfolio' && (
          <Portfolio />
        )}

        {page === 'positions' && (
          <PositionManager />
        )}

        {page === 'instruments' && (
          <InstrumentManager />
        )}

        {page === 'market' && (
          <MarketData />
        )}

        {page === 'networth' && (
          <NetWorth />
        )}

        {page === 'fire' && (
          <Fire />
        )}

        {page === 'admin' && (
          <Admin />
        )}
      </main>
    </div>
  )
}

const menuButtonStyle = {
  background: 'transparent',
  border:
    '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  textAlign: 'left' as const,
  padding: '12px',
  cursor: 'pointer',
  fontSize: '16px',
  borderRadius: '8px',
}

export default App