import { useState, type FormEvent } from 'react'
import { api } from '../api'
import { dayKey, formatDuration, HEB_WEEKDAYS, parseDayKey } from '../lib/time'
import { hebrewDate } from '../lib/hebrew'
import { resolveEntry } from '../lib/entry'
import { Modal } from './Modal'
import { toast } from './Toaster'
import { normalizeTime, TimeField } from './TimeInput'

export function AddEntryDialog({ defaultDay, onClose, onSaved }: { defaultDay: Date; onClose: () => void; onSaved: () => void }) {
  const [day, setDay] = useState(dayKey(defaultDay))
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const dayDate = day ? parseDayKey(day) : null
  const ns = normalizeTime(start)
  const ne = normalizeTime(end)
  const entry = dayDate && ns && ne ? resolveEntry(dayDate, ns, ne) : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!entry) return setError('צריך לבחור תאריך, שעת התחלה ושעת סיום.')
    setBusy(true)
    try {
      await api.createSession({ start_at: entry.start.toISOString(), end_at: entry.end.toISOString(), description: desc.trim() })
      toast('הרישום נוסף')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="הוספת רישום" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="label" htmlFor="entry-day">
          תאריך
        </label>
        <input id="entry-day" type="date" className="field" value={day} onChange={(e) => setDay(e.target.value)} />
        {dayDate && (
          <p className="mt-1.5 text-sm text-ink-soft">
            יום {HEB_WEEKDAYS[dayDate.getDay()]}, {hebrewDate(dayDate)}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="entry-start">
              התחלה
            </label>
            <TimeField id="entry-start" className="field num text-center" value={start} onChange={setStart} />
          </div>
          <div>
            <label className="label" htmlFor="entry-end">
              סיום
            </label>
            <TimeField id="entry-end" autoFocus className="field num text-center" value={end} onChange={setEnd} />
          </div>
        </div>
        {entry && (
          <p className="mt-2 text-sm text-ink-soft">
            משך: <span className="num font-medium text-ink">{formatDuration(entry.end.getTime() - entry.start.getTime())}</span>
            {entry.overnight && ' (הסיום למחרת)'}
          </p>
        )}

        <label className="label mt-4" htmlFor="entry-desc">
          מה עשיתי
        </label>
        <input id="entry-desc" className="field" placeholder="לא חובה" value={desc} onChange={(e) => setDesc(e.target.value)} />

        {error && <p className="mt-3 text-[15px] text-stop">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            הוספת רישום
          </button>
        </div>
      </form>
    </Modal>
  )
}
