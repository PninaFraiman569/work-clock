import { useState } from 'react'
import { api, type CycleHistory } from '../api'
import { changeLines, scheduleFromHistory } from '../lib/cycleChange'
import { monthIndex, parseDayKey } from '../lib/time'
import { Modal } from './Modal'
import { toastError } from './Toaster'

/** הודעה חד-פעמית למשתמש כשמנהל שינה לו את הגדרת החודש */
export function MonthNotice({ profileDay, history }: { profileDay: number; history: CycleHistory }) {
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const pending = history.changes.filter((c) => c.notice_pending)
  if (done || pending.length === 0) return null

  const schedule = scheduleFromHistory(profileDay, history)
  const lines = pending.flatMap((c) => {
    const d = parseDayKey(c.effective_month)
    return changeLines(schedule, monthIndex(d.getFullYear(), d.getMonth()))
  })

  async function acknowledge() {
    setBusy(true)
    try {
      await api.ackCycleNotices()
      setDone(true)
    } catch (e) {
      toastError(e)
      setBusy(false)
    }
  }

  return (
    <Modal title="המנהל עדכן את הגדרת החודש שלך" onClose={() => undefined} persistent>
      <div className="space-y-2 text-[15px]">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        <p className="text-ink-soft">אפשר לראות את ההיסטוריה בתפריט המשתמש, תחת "הגדרת חודש".</p>
      </div>
      <div className="mt-6 flex justify-end">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void acknowledge()}>
          הבנתי
        </button>
      </div>
    </Modal>
  )
}
