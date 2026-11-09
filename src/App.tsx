import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'

function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
      }}
    >
      <aside
        style={{
          width: '250px',
          background: '#1f2937',
          color: 'white',
          padding: '20px',
        }}
      >
        <h2>FIRE WM</h2>

        <p
          style={{ cursor: 'pointer' }}
          onClick={() => setPage('dashboard')}
        >
          🏠 Dashboard
        </p>

        <p
          style={{ cursor: 'pointer' }}
          onClick={() => setPage('portfolio')}
        >
          💼 Portfolio
        </p>
      </aside>

      <main
        style={{
          flex: 1,
          padding: '30px',
        }}
      >
        {page === 'dashboard' && <Dashboard />}
        {page === 'portfolio' && <Portfolio />}
      </main>
    </div>
  )
}

export default App