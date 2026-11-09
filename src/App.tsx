import { useState } from 'react'

import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import NetWorth from './pages/NetWorth'
import Fire from './pages/Fire'

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
          width: '240px',
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

        {page === 'networth' && (
          <NetWorth />
        )}

        {page === 'fire' && <Fire />}
      </main>
    </div>
  )
}

const menuButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'white',
  textAlign: 'left' as const,
  padding: '10px 0',
  cursor: 'pointer',
  fontSize: '16px',
}

export default App