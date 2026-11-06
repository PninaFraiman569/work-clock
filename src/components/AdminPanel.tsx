import { useState, type FormEvent } from 'react'
import { CalendarCog, KeyRound, LoaderCircle, UserPlus } from 'lucide-react'
import { api, type Profile } from '../api'
import { DEFAULT_CYCLE_START_DAY } from '../config'
import { MonthSettingsDialog } from './MonthSettingsDialog'
import { useLoad } from '../hooks/hooks'
import { Modal } from './Modal'
import { toast, toastError } from './Toaster'

const CYCLE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

export function AdminPanel({ me, onClose, onSelfChanged }: { me: Profile; onClose: () => void; onSelfChanged: () => void }) {
  const users = useLoad(() => api.adminListUsers(), [])
  const [resetFor, setResetFor] = useState<Profile | null>(null)
  const [monthFor, setMonthFor] = useState<Profile | null>(null)

  async function update(u: Profile, patch: { display_name?: string; disabled?: boolean }, msg: string) {
    try {
      await api.adminUpdateUser(u.id, patch)
      toast(msg)
      await users.reload()
      if (u.id === me.id) onSelfChanged()
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <Modal title="ניהול משתמשים" onClose={onClose} wide>
      <NewUserForm onCreated={() => void users.reload()} />

      <h3 className="mt-8 mb-3 font-display text-lg font-semibold">משתמשים קיימים</h3>
      {users.error && <p className="text-stop">{users.error}</p>}
      {!users.data && !users.error && <div className="h-24 animate-pulse rounded-xl bg-sunk" />}
      {users.data && (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="bg-sunk text-sm text-ink-soft">
                <th className="px-4 py-2.5 text-start font-medium">שם</th>
                <th className="px-3 py-2.5 text-start font-medium">שם משתמש</th>
                <th className="px-3 py-2.5 text-start font-medium">המחזור מתחיל ב-</th>
                <th className="px-3 py-2.5 text-start font-medium">מצב</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-medium">
                    {u.display_name || '—'}
                    {u.is_admin && <span className="ms-2 rounded-md bg-brand-tint px-1.5 py-0.5 text-xs text-brand">מנהל</span>}
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft" dir="auto">
                    {u.username}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      className="btn btn-ghost h-8 px-2.5 text-sm"
                      onClick={() => setMonthFor(u)}
                      title="הגדרת חודש והיסטוריה"
                      aria-label={`הגדרת חודש של ${u.display_name || u.username}`}
                    >
                      <CalendarCog size={15} />
                      {u.cycle_start_day} לחודש
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    {u.id === me.id ? (
                      <span className="text-ink-soft">פעיל</span>
                    ) : (
                      <button
                        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                          u.disabled ? 'bg-stop-tint text-stop hover:bg-stop/15' : 'bg-live-tint text-live hover:bg-live/15'
                        }`}
                        onClick={() => update(u, { disabled: !u.disabled }, u.disabled ? 'המשתמש הופעל מחדש' : 'המשתמש הושבת')}
                        title={u.disabled ? 'לחיצה תפעיל את המשתמש' : 'לחיצה תשבית את המשתמש'}
                      >
                        {u.disabled ? 'מושבת' : 'פעיל'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <button className="btn btn-ghost h-8 px-2.5 text-sm" onClick={() => setResetFor(u)}>
                      <KeyRound size={15} />
                      איפוס סיסמה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetFor && <ResetPassword user={resetFor} onDone={() => setResetFor(null)} />}
      {monthFor && (
        <MonthSettingsDialog
          user={monthFor}
          isSelf={monthFor.id === me.id}
          onClose={() => setMonthFor(null)}
          onSaved={() => {
            void users.reload()
            if (monthFor.id === me.id) onSelfChanged()
          }}
        />
      )}
    </Modal>
  )
}

function NewUserForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cycleDay, setCycleDay] = useState(DEFAULT_CYCLE_START_DAY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username.trim()) return setError('צריך לבחור שם משתמש.')
    if (/\s/.test(username.trim())) return setError('שם המשתמש לא יכול להכיל רווחים.')
    if (password.length < 6) return setError('הסיסמה צריכה להכיל לפחות 6 תווים.')
    setBusy(true)
    try {
      await api.adminCreateUser({ username: username.trim(), display_name: name.trim(), password, cycle_start_day: cycleDay })
      toast(`המשתמש ${username.trim()} נוצר`)
      setName('')
      setUsername('')
      setPassword('')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-sunk p-5">
      <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        <UserPlus size={20} className="text-brand" />
        הוספת משתמש
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <label className="label" htmlFor="nu-name">
            שם מלא (לתצוגה)
          </label>
          <input id="nu-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: משה כהן" />
        </div>
        <div>
          <label className="label" htmlFor="nu-user">
            שם משתמש (לכניסה)
          </label>
          <input id="nu-user" className="field" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="למשל: moshe" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="nu-pass">
            סיסמה ראשונית
          </label>
          <input id="nu-pass" className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 6 תווים" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="nu-cycle">
            המחזור החודשי מתחיל ב-
          </label>
          <select id="nu-cycle" className="field" value={cycleDay} onChange={(e) => setCycleDay(Number(e.target.value))}>
            {CYCLE_DAYS.map((d) => (
              <option key={d} value={d}>
                {d} לחודש
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="mt-3 text-[15px] text-stop">{error}</p>}
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-soft">את שם המשתמש והסיסמה מוסרים למשתמש. הוא יוכל לשנות את הסיסמה בעצמו אחרי הכניסה.</p>
        <button type="submit" className="btn btn-primary shrink-0" disabled={busy}>
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <UserPlus size={18} />}
          הוספת משתמש
        </button>
      </div>
    </form>
  )
}

function ResetPassword({ user, onDone }: { user: Profile; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 6) return setError('הסיסמה צריכה להכיל לפחות 6 תווים.')
    setBusy(true)
    try {
      await api.adminResetPassword(user.id, pw)
      toast(`הסיסמה של ${user.display_name || user.username} אופסה`)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={`איפוס סיסמה: ${user.display_name || user.username}`} onClose={onDone}>
      <form onSubmit={submit}>
        <label className="label" htmlFor="rp">
          סיסמה חדשה
        </label>
        <input id="rp" className="field" autoFocus autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
        {error && <p className="mt-3 text-[15px] text-stop">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onDone}>
            ביטול
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            איפוס סיסמה
          </button>
        </div>
      </form>
    </Modal>
  )
}
