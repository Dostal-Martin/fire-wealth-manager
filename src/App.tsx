import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  type Session,
} from '@supabase/supabase-js'

import {
  supabase,
} from './lib/supabase'

import Login from './pages/Login'

import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Performance from './pages/Performance'
import MarketData from './pages/MarketData'
import PriceHistory from './pages/PriceHistory'
import NetWorth from './pages/NetWorth'
import Fire from './pages/Fire'
import Cashflow from './pages/Cashflow'
import Income from './pages/Income'
import PositionManager from './pages/PositionManager'
import InstrumentManager from './pages/InstrumentManager'
import Admin from './pages/Admin'

import {
  getPriceUpdateStatus,
  pricesUpdatedToday,
  updateMarketPrices,
} from './services/priceUpdater'

type Page =
  | 'dashboard'
  | 'portfolio'
  | 'performance'
  | 'market'
  | 'prices'
  | 'networth'
  | 'fire'
  | 'cashflow'
  | 'income'
  | 'positions'
  | 'instruments'
  | 'admin'

function formatUpdateDateTime(
  value:
    | string
    | null
) {
  if (!value) {
    return null
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date.toLocaleString(
    'cs-CZ',
    {
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  )
}

function App() {
  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null
    )

  const [
    authLoading,
    setAuthLoading,
  ] =
    useState(true)

  const [
    page,
    setPage,
  ] =
    useState<Page>(
      'dashboard'
    )

  const [
    priceRefreshVersion,
    setPriceRefreshVersion,
  ] =
    useState(0)

  const [
    updateStatus,
    setUpdateStatus,
  ] =
    useState(
      'Kontroluji stav...'
    )

  const [
    pricesUpdating,
    setPricesUpdating,
  ] =
    useState(false)

  const [
    signingOut,
    setSigningOut,
  ] =
    useState(false)

  /*
   * AUTH
   *
   * 1. Při startu zjistíme existující session.
   * 2. Sledujeme přihlášení / odhlášení.
   * 3. Supabase si session standardně
   *    obnovuje přes svůj klientský SDK.
   */
  useEffect(() => {
    let mounted = true

    async function loadSession() {
      try {
        const {
          data,
          error,
        } =
          await supabase
            .auth
            .getSession()

        if (error) {
          throw error
        }

        if (mounted) {
          setSession(
            data.session
          )
        }
      } catch (error) {
        console.error(
          'Auth session:',
          error
        )

        if (mounted) {
          setSession(null)
        }
      } finally {
        if (mounted) {
          setAuthLoading(
            false
          )
        }
      }
    }

    loadSession()

    const {
      data:
        authListener,
    } =
      supabase
        .auth
        .onAuthStateChange(
          (
            _event,
            nextSession
          ) => {
            if (!mounted) {
              return
            }

            setSession(
              nextSession
            )

            setAuthLoading(
              false
            )

            if (
              !nextSession
            ) {
              setPage(
                'dashboard'
              )

              setUpdateStatus(
                ''
              )
            }
          }
        )

    return () => {
      mounted = false

      authListener
        .subscription
        .unsubscribe()
    }
  }, [])

  /*
   * MARKET DATA
   *
   * Spouštíme až po přihlášení.
   *
   * Denní stav se kontroluje
   * v Supabase app_sync_status,
   * ne v localStorage.
   */
  useEffect(() => {
    if (!session) {
      return
    }

    let cancelled = false

    async function initializeMarketData() {
      try {
        setPricesUpdating(
          true
        )

        setUpdateStatus(
          'Kontroluji stav cen...'
        )

        const [
          updatedToday,
          status,
        ] =
          await Promise.all([
            pricesUpdatedToday(),
            getPriceUpdateStatus(),
          ])

        if (cancelled) {
          return
        }

        if (updatedToday) {
          const formattedTime =
            formatUpdateDateTime(
              status
                .lastSuccessAt
            )

          setUpdateStatus(
            formattedTime
              ? `Aktualizováno ${formattedTime}`
              : 'Ceny dnes aktualizovány'
          )

          return
        }

        setUpdateStatus(
          'Aktualizuji ceny...'
        )

        const result =
          await updateMarketPrices()

        if (cancelled) {
          return
        }

        if (
          result.updatedCount >
          0
        ) {
          setPriceRefreshVersion(
            (value) =>
              value + 1
          )
        }

        if (
          result.errorCount ===
          0
        ) {
          setUpdateStatus(
            `Aktualizováno ${result.updatedCount}/${result.processed}`
          )
        } else {
          setUpdateStatus(
            `${result.updatedCount}/${result.processed}, chyby ${result.errorCount}`
          )
        }
      } catch (error) {
        console.error(
          'Automatická aktualizace cen:',
          error
        )

        if (cancelled) {
          return
        }

        try {
          const status =
            await getPriceUpdateStatus()

          const formattedTime =
            formatUpdateDateTime(
              status
                .lastSuccessAt
            )

          setUpdateStatus(
            formattedTime
              ? `Poslední update ${formattedTime}`
              : 'Aktualizace cen se nezdařila'
          )
        } catch (
          statusError
        ) {
          console.error(
            'Načtení stavu aktualizace:',
            statusError
          )

          setUpdateStatus(
            'Aktualizace cen se nezdařila'
          )
        }
      } finally {
        if (!cancelled) {
          setPricesUpdating(
            false
          )
        }
      }
    }

    initializeMarketData()

    return () => {
      cancelled = true
    }
  }, [session])

  function handlePricesUpdated() {
    setPriceRefreshVersion(
      (value) =>
        value + 1
    )

    setUpdateStatus(
      'Ceny právě aktualizovány'
    )
  }

  async function handleSignOut() {
    try {
      setSigningOut(true)

      const {
        error,
      } =
        await supabase
          .auth
          .signOut()

      if (error) {
        throw error
      }
    } catch (error) {
      console.error(
        'Sign out:',
        error
      )
    } finally {
      setSigningOut(false)
    }
  }

  /*
   * AUTH LOADING
   *
   * Během kontroly session ještě
   * nezobrazujeme Login, aby při
   * reloadu obrazovka neproblikla.
   */
  if (authLoading) {
    return (
      <div className="login-page">
        <div
          style={{
            color:
              'var(--text-secondary)',

            fontSize:
              '12px',
          }}
        >
          Ověřuji přihlášení...
        </div>
      </div>
    )
  }

  /*
   * AUTH GATE
   */
  if (!session) {
    return <Login />
  }

  const userEmail =
    session.user.email ??
    'Přihlášený uživatel'

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            FW
          </div>

          <div>
            <div className="sidebar-brand-name">
              FIRE WM
            </div>

            <div className="sidebar-brand-subtitle">
              Wealth Manager
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavigationSection
            title="Přehled"
          >
            <NavigationItem
              title="Dashboard"
              active={
                page ===
                'dashboard'
              }
              onClick={() =>
                setPage(
                  'dashboard'
                )
              }
            />

            <NavigationItem
              title="Portfolio"
              active={
                page ===
                'portfolio'
              }
              onClick={() =>
                setPage(
                  'portfolio'
                )
              }
            />

            <NavigationItem
              title="FIRE"
              active={
                page ===
                'fire'
              }
              onClick={() =>
                setPage(
                  'fire'
                )
              }
            />
          </NavigationSection>

          <NavigationSection
            title="Analýza"
          >
            <NavigationItem
              title="Výkonnost"
              active={
                page ===
                'performance'
              }
              onClick={() =>
                setPage(
                  'performance'
                )
              }
            />

            <NavigationItem
              title="Vývoj majetku"
              active={
                page ===
                'networth'
              }
              onClick={() =>
                setPage(
                  'networth'
                )
              }
            />

            <NavigationItem
              title="Příjmy"
              active={
                page ===
                'income'
              }
              onClick={() =>
                setPage(
                  'income'
                )
              }
            />

            <NavigationItem
              title="Historie cen"
              active={
                page ===
                'prices'
              }
              onClick={() =>
                setPage(
                  'prices'
                )
              }
            />

            <NavigationItem
              title="Tržní data"
              active={
                page ===
                'market'
              }
              onClick={() =>
                setPage(
                  'market'
                )
              }
            />
          </NavigationSection>

          <NavigationSection
            title="Správa"
          >
            <NavigationItem
              title="Pozice"
              active={
                page ===
                'positions'
              }
              onClick={() =>
                setPage(
                  'positions'
                )
              }
            />

            <NavigationItem
              title="Instrumenty"
              active={
                page ===
                'instruments'
              }
              onClick={() =>
                setPage(
                  'instruments'
                )
              }
            />

            <NavigationItem
              title="Cashflow"
              active={
                page ===
                'cashflow'
              }
              onClick={() =>
                setPage(
                  'cashflow'
                )
              }
            />

            <NavigationItem
              title="Data"
              active={
                page ===
                'admin'
              }
              onClick={() =>
                setPage(
                  'admin'
                )
              }
            />
          </NavigationSection>
        </nav>

        <div className="sidebar-account">
          <div className="sidebar-account-email">
            {userEmail}
          </div>

          <button
            className="sidebar-signout"
            onClick={
              handleSignOut
            }
            disabled={
              signingOut
            }
          >
            {signingOut
              ? 'Odhlášení...'
              : 'Odhlásit se'}
          </button>
        </div>

        <div className="sidebar-footer">
          <div
            className={[
              'sidebar-status-dot',

              pricesUpdating
                ? 'sidebar-status-updating'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />

          <div>
            <div className="sidebar-status-label">
              Tržní data
            </div>

            <div className="sidebar-status-value">
              {updateStatus ||
                'Připraveno'}
            </div>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-content">
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
            'performance' && (
            <Performance
              key={
                priceRefreshVersion
              }
            />
          )}

          {page ===
            'market' && (
            <MarketData
              onPricesUpdated={
                handlePricesUpdated
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
            <NetWorth
              key={
                priceRefreshVersion
              }
            />
          )}

          {page ===
            'fire' && (
            <Fire
              key={
                priceRefreshVersion
              }
            />
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
            'positions' && (
            <PositionManager />
          )}

          {page ===
            'instruments' && (
            <InstrumentManager />
          )}

          {page ===
            'admin' && (
            <Admin />
          )}
        </div>
      </main>
    </div>
  )
}

function NavigationSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-title">
        {title}
      </div>

      <div className="sidebar-section-items">
        {children}
      </div>
    </div>
  )
}

function NavigationItem({
  title,
  active,
  onClick,
}: {
  title: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className={
        active
          ? 'sidebar-item sidebar-item-active'
          : 'sidebar-item'
      }
      onClick={onClick}
    >
      <span className="sidebar-item-indicator" />

      <span>
        {title}
      </span>
    </button>
  )
}

export default App