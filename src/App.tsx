import { useCallback, useEffect, useState } from 'react'
import { api, type CycleHistory, type Profile } from './api'
import { Login } from './components/Login'
import { MainScreen } from './components/MainScreen'
import { Toaster, toastError } from './components/Toaster'
import { Logo } from './components/Logo'

export function App() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [account, setAccount] = useState<{ profile: Profile; history: CycleHistory } | null>(null)
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
    loadAccount().catch((e) => {
      toastError(e)
      void api.signOut()
    })
  }, [userId, loadAccount])

  let content
  if (userId === undefined || (userId && !profile)) {
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
