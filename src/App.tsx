import { useEffect, useState } from 'react'
import { api, type Profile } from './api'
import { Login } from './components/Login'
import { MainScreen } from './components/MainScreen'
import { Toaster, toastError } from './components/Toaster'
import { Logo } from './components/Logo'

export function App() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | null>(null)

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
      setProfile(null)
      return
    }
    api
      .getProfile()
      .then(setProfile)
      .catch((e) => {
        toastError(e)
        void api.signOut()
      })
  }, [userId])

  let content
  if (userId === undefined || (userId && !profile)) {
    content = (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse">
          <Logo size={44} />
        </div>
      </div>
    )
  } else if (!userId || !profile) {
    content = <Login />
  } else {
    content = <MainScreen profile={profile} onProfileChange={setProfile} />
  }

  return (
    <>
      {content}
      <Toaster />
    </>
  )
}
