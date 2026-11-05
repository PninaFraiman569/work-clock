import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { Modal } from './Modal'
import { toast } from './Toaster'

export function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (pw.length < 6) return setError('הסיסמה צריכה להכיל לפחות 6 תווים.')
    if (pw !== pw2) return setError('הסיסמאות לא זהות.')
    setBusy(true)
    try {
      await api.changePassword(pw)
      toast('הסיסמה שונתה')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="שינוי סיסמה" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="label" htmlFor="pw1">
          סיסמה חדשה
        </label>
        <input id="pw1" type="password" className="field" autoFocus autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <label className="label mt-4" htmlFor="pw2">
          שוב את הסיסמה החדשה
        </label>
        <input id="pw2" type="password" className="field" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {error && <p className="mt-3 text-[15px] text-stop">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            שינוי סיסמה
          </button>
        </div>
      </form>
    </Modal>
  )
}
