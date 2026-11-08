import { useCallback, useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { api, NetworkError, type CycleHistory, type Profile } from './api'
import { Login } from './components/Login'
import { MainScreen } from './components/MainScreen'
import { Toaster, toastError } from './components/Toaster'
import { Logo } from './components/Logo'

export function App() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [account, setAccount] = useState<{ profile: Profile; history: CycleHistory } | null>(null)
  // בפעם הראשונה במחשב צריך חיבור, כדי לטעון את פרטי המשתמש
  const [needsConnection, setNeedsConnection] = useState(false)
  const profile = account?.profile ?? null

  const loadAccount = useCallback(async () => {
    const [profile, history] = await Promise.all([api.getProfile(), api.getCycleHistory()])
    setAccount({ profile, history })
  }, [])

  useEffect(() => {
    let alive = true
    api.currentUserId().then((id) => alive && setUserId(id))
    const off = api.onAuthChange((id) => setUserId(id))
    return () => {
      alive = false
      off()
    }
  }, [])

  useEffect(() => {
    if (!userId) {
      setAccount(null)
      return
    }
    const load = () =>
      loadAccount()
        .then(() => setNeedsConnection(false))
        .catch((e) => {
          // בלי חיבור לא מנתקים: מחכים שהחיבור יחזור
          if (e instanceof NetworkError) return setNeedsConnection(true)
          toastError(e)
          void api.signOut()
        })
    void load()
    window.addEventListener('online', load)
    return () => window.removeEventListener('online', load)
  }, [userId, loadAccount])

  let content
  if (userId && !profile && needsConnection) {
    content = (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="max-w-md text-center">
          <WifiOff size={40} className="mx-auto text-ink-soft" />
          <h1 className="mt-4 font-display text-2xl font-semibold">אין חיבור לאינטרנט</h1>
          <p className="mt-2 text-ink-soft">בפעם הראשונה במחשב הזה צריך חיבור. אחרי שהפרטים ייטענו פעם אחת, אפשר לעבוד גם בלי חיבור.</p>
          <button className="btn btn-primary mt-6" onClick={() => loadAccount().then(() => setNeedsConnection(false), () => toastError(new NetworkError('עדיין אין חיבור לאינטרנט.')))}>
            ניסיון נוסף
          </button>
        </div>
      </div>
    )
  } else if (userId === undefined || (userId && !profile)) {
    content = (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse">
          <Logo size={44} />
        </div>
      </div>
    )
  } else if (!userId || !account) {
    content = <Login />
  } else {
    content = <MainScreen profile={account.profile} history={account.history} onAccountChanged={() => loadAccount().catch(toastError)} />
  }

  return (
    <>
      {content}
      <Toaster />
    </>
  )
}
