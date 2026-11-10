import {
  useState,
  type FormEvent,
} from 'react'

import {
  supabase,
} from '../lib/supabase'

export default function Login() {
  const [
    email,
    setEmail,
  ] = useState('')

  const [
    password,
    setPassword,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault()

    if (
      !email.trim() ||
      !password
    ) {
      setErrorMessage(
        'Zadej e-mail a heslo.'
      )

      return
    }

    try {
      setLoading(true)
      setErrorMessage('')

      const {
        error,
      } =
        await supabase
          .auth
          .signInWithPassword({
            email:
              email.trim(),

            password,
          })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error(
        'Login:',
        error
      )

      setErrorMessage(
        'Přihlášení se nezdařilo. Zkontroluj e-mail a heslo.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-mark">
            FW
          </div>

          <div>
            <div className="login-brand-name">
              FIRE WM
            </div>

            <div className="login-brand-subtitle">
              Wealth Manager
            </div>
          </div>
        </div>

        <div className="login-content">
          <h1>
            Přihlášení
          </h1>

          <p>
            Přístup k osobnímu
            finančnímu portfoliu.
          </p>

          <form
            onSubmit={
              handleSubmit
            }
          >
            <div className="login-field">
              <label className="form-label">
                E-mail
              </label>

              <input
                className="form-control"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(
                  event
                ) =>
                  setEmail(
                    event.target
                      .value
                  )
                }
                autoFocus
              />
            </div>

            <div className="login-field">
              <label className="form-label">
                Heslo
              </label>

              <input
                className="form-control"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(
                  event
                ) =>
                  setPassword(
                    event.target
                      .value
                  )
                }
              />
            </div>

            {errorMessage && (
              <div className="login-error">
                {errorMessage}
              </div>
            )}

            <button
              className="button-primary login-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Přihlašuji...'
                : 'Přihlásit se'}
            </button>
          </form>
        </div>

        <div className="login-footer">
          Soukromá aplikace
        </div>
      </div>
    </div>
  )
}