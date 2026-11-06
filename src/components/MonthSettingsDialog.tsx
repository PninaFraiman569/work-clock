import { useMemo, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { api, type CycleHistory, type Profile } from '../api'
import { useLoad } from '../hooks/hooks'
import { dayRuleText, historyRows, previewChange, scheduleFromHistory, type HistoryRow } from '../lib/cycleChange'
import { Modal } from './Modal'
import { toast, toastError } from './Toaster'

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

/** הגדרת חודש של המשתמש המחובר, או של משתמש אחר כשמנהל פותח אותה */
export function MonthSettingsDialog({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: Profile
  isSelf: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const history = useLoad(() => api.getCycleHistory(isSelf ? undefined : user.id), [user.id, isSelf])
  const title = isSelf ? 'הגדרת חודש' : `הגדרת חודש: ${user.display_name || user.username}`

  return (
    <Modal title={title} onClose={onClose}>
      {history.error && <p className="text-[15px] text-stop">{history.error}</p>}
      {!history.data && !history.error && <div className="h-40 animate-pulse rounded-xl bg-sunk" />}
      {history.data && <Form user={user} isSelf={isSelf} history={history.data} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  )
}

function Form({
  user,
  isSelf,
  history,
  onClose,
  onSaved,
}: {
  user: Profile
  isSelf: boolean
  history: CycleHistory
  onClose: () => void
  onSaved: () => void
}) {
  const [day, setDay] = useState(user.cycle_start_day)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const schedule = useMemo(() => scheduleFromHistory(user.cycle_start_day, history), [user.cycle_start_day, history])
  const now = new Date()
  const rows = historyRows(schedule, history.since, now)
  const preview = previewChange(schedule, day, now)
  const changed = day !== user.cycle_start_day

  async function save() {
    setBusy(true)
    try {
      await api.setCycleStartDay(day, isSelf ? undefined : user.id)
      toast('הגדרת החודש עודכנה')
      onSaved()
      onClose()
    } catch (e) {
      toastError(e)
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <label className="label" htmlFor="month-start-day">
        באיזה יום החודש מתחיל?
      </label>
      <select id="month-start-day" className="field" value={day} onChange={(e) => setDay(Number(e.target.value))}>
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {d} לחודש
          </option>
        ))}
      </select>
      <p className="mt-2 text-[15px] text-ink-soft">
        {isSelf ? 'החודש שלך יהיה' : 'החודש יהיה'} {dayRuleText(day)}. השינוי מתחיל מהחודש הבא, והחודשים שכבר התחילו לא משתנים.
      </p>

      <h3 className="mt-6 mb-2 font-display text-lg font-semibold">היסטוריה</h3>
      <ul className="overflow-hidden rounded-xl border border-line text-[15px]">
        {rows.map((r) => (
          <HistoryItem key={r.key} row={r} />
        ))}
      </ul>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          סגירה
        </button>
        <button type="button" className="btn btn-primary" disabled={!changed} onClick={() => setConfirming(true)}>
          שמירה
        </button>
      </div>

      {confirming && (
        <Modal title="שינוי הגדרת החודש" onClose={() => setConfirming(false)}>
          <div className="space-y-2 text-[15px]">
            {preview.kind === 'change' ? (
              preview.lines.map((line) => <p key={line}>{line}</p>)
            ) : (
              <>
                <p>השינוי שתוכנן לחודש הבא יבוטל.</p>
                <p>החודש ימשיך להיות {dayRuleText(preview.dayInForce)}, בלי חודש מעבר.</p>
              </>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
              ביטול
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
              {busy && <LoaderCircle size={18} className="animate-spin" />}
              אישור
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

const STATUS_LABEL: Record<HistoryRow['status'], string | null> = {
  past: null,
  current: 'עכשיו',
  upcoming: 'מתוכנן',
}

function HistoryItem({ row }: { row: HistoryRow }) {
  const label = STATUS_LABEL[row.status]
  return (
    <li className={`border-b border-line px-3.5 py-2.5 last:border-b-0 ${row.transition ? 'bg-note-tint' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="num font-medium">
          {row.title && <span className="font-semibold">{row.title}: </span>}
          {row.range}
        </span>
        {label && (
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${row.status === 'current' ? 'bg-live-tint text-live' : 'bg-brand-tint text-brand'}`}>
            {label}
          </span>
        )}
      </div>
      <div className={row.transition ? 'text-note' : 'text-ink-soft'}>{row.text}</div>
    </li>
  )
}
