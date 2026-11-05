import { useEffect, useRef, useState } from 'react'
import { ChevronDown, KeyRound, LogOut, Users } from 'lucide-react'
import { api, type Profile } from '../api'
import { APP_NAME } from '../config'
import { Logo } from './Logo'
import { PasswordDialog } from './PasswordDialog'
import { AdminPanel } from './AdminPanel'

export function Header({ profile, onProfileChange }: { profile: Profile; onProfileChange: (p: Profile) => void }) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'password' | 'admin' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const name = profile.display_name || profile.username
  const initial = name.trim().charAt(0)

  return (
    <>
      {api.demo && (
        <div className="bg-note-tint py-1.5 text-center text-sm text-note">
          מצב הדגמה: הנתונים נשמרים רק בדפדפן הזה. אחרי חיבור ל-Supabase האתר יעבוד עם משתמשים אמיתיים.
        </div>
      )}
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <span className="font-display text-xl font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="relative" ref={ref}>
          <button
            className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 ps-1.5 pe-3 transition-colors hover:bg-sunk"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            <span className="grid size-8 place-items-center rounded-full bg-brand-tint font-display font-semibold text-brand">
              {initial}
            </span>
            <span className="font-medium">{name}</span>
            <ChevronDown size={16} className="text-ink-soft" />
          </button>

          {open && (
            <div className="modal-in absolute top-full left-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1.5 shadow-xl">
              <MenuItem icon={<KeyRound size={17} />} onClick={() => (setDialog('password'), setOpen(false))}>
                שינוי סיסמה
              </MenuItem>
              {profile.is_admin && (
                <MenuItem icon={<Users size={17} />} onClick={() => (setDialog('admin'), setOpen(false))}>
                  ניהול משתמשים
                </MenuItem>
              )}
              <div className="my-1.5 border-t border-line" />
              <MenuItem icon={<LogOut size={17} />} onClick={() => void api.signOut()}>
                יציאה
              </MenuItem>
            </div>
          )}
        </div>
      </header>

      {dialog === 'password' && <PasswordDialog onClose={() => setDialog(null)} />}
      {dialog === 'admin' && (
        <AdminPanel
          me={profile}
          onClose={() => setDialog(null)}
          onSelfChanged={() => api.getProfile().then(onProfileChange)}
        />
      )}
    </>
  )
}

function MenuItem({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-sunk" onClick={onClick}>
      <span className="text-ink-soft">{icon}</span>
      {children}
    </button>
  )
}
