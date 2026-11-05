import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { api } from '../api'
import { APP_NAME } from '../config'
import { Logo } from './Logo'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('צריך למלא שם משתמש וסיסמה.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.signIn(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-5 font-display text-[32px] font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-ink-soft">כניסה לרישום שעות העבודה שלך</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-7 shadow-[0_1px_0_#dde2ec,0_12px_32px_-12px_rgb(30_42_90/0.18)]">
          <label className="label" htmlFor="username">
            שם משתמש
          </label>
          <input
            id="username"
            className="field"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label className="label mt-5" htmlFor="password">
            סיסמה
          </label>
          <div className="relative">
            <input
              id="password"
              className="field pe-11"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="icon-btn absolute top-1/2 left-1.5 -translate-y-1/2"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p className="mt-4 rounded-lg bg-stop-tint px-3 py-2 text-[15px] text-stop">{error}</p>}

          <button type="submit" className="btn btn-primary mt-6 h-12 w-full text-base" disabled={busy}>
            {busy ? <LoaderCircle size={20} className="animate-spin" /> : 'כניסה'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-soft">
          {api.demo ? (
            <>
              מצב הדגמה: שם משתמש <b className="text-ink">demo</b> וסיסמה <b className="text-ink">demo</b>
            </>
          ) : (
            'אין לך משתמש או ששכחת את הסיסמה? אפשר לפנות למנהל.'
          )}
        </p>
      </div>
    </main>
  )
}
