import { useEffect, useRef, useState } from 'react'
import { CalendarDays, CalendarRange, FileSpreadsheet, LoaderCircle, Sun } from 'lucide-react'
import { api } from '../api'
import { cycleFor, cycleRangeText, cycleTitle, dayKey, formatDate, HEB_MONTHS, HEB_WEEKDAYS, type Range } from '../lib/time'
import { toast, toastError } from './Toaster'
import { rangeFor, type Mode } from './Records'

export function ExportMenu({ anchor, startDay, userName, mode }: { anchor: Date; startDay: number; userName: string; mode: Mode }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<Mode | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const cycle = cycleFor(anchor, startDay)
  const year = cycle.labelYear
  const options: { kind: Mode; icon: React.ReactNode; title: string; sub: string; fileTitle: string }[] = [
    {
      kind: 'day',
      icon: <Sun size={20} />,
      title: 'יום',
      sub: `${HEB_WEEKDAYS[anchor.getDay()]}, ${formatDate(anchor)}`,
      fileTitle: formatDate(anchor).replaceAll('/', '-'),
    },
    {
      kind: 'month',
      icon: <CalendarDays size={20} />,
      title: `חודש ${cycleTitle(cycle)}`,
      sub: cycleRangeText(cycle),
      fileTitle: `${HEB_MONTHS[cycle.labelMonth]}-${cycle.labelYear}`,
    },
    { kind: 'year', icon: <CalendarRange size={20} />, title: `שנת ${year}`, sub: 'כל החודשים וסיכום חודשי', fileTitle: String(year) },
  ]
  // התצוגה הנוכחית ראשונה
  options.sort((a, b) => (a.kind === mode ? -1 : b.kind === mode ? 1 : 0))

  async function run(o: (typeof options)[number]) {
    setBusy(o.kind)
    try {
      const range: Range = rangeFor(o.kind, anchor, startDay)
      const [sessions, notes] = await Promise.all([
        api.listSessions(range.start, range.end),
        api.listNotes(dayKey(range.start), dayKey(range.end)),
      ])
      const { exportToExcel } = await import('../lib/export')
      await exportToExcel({
        kind: o.kind,
        title: o.kind === 'day' ? o.sub : o.title,
        fileName: `שעות-עבודה-${o.fileTitle}.xlsx`,
        range,
        sessions,
        notes,
        userName,
        startDay,
        year,
      })
      toast('קובץ האקסל ירד למחשב')
      setOpen(false)
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button className="btn btn-primary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <FileSpreadsheet size={18} />
        ייצוא לאקסל
      </button>
      {open && (
        <div className="modal-in absolute top-full left-0 z-30 mt-2 w-[300px] rounded-2xl border border-line bg-surface p-2 shadow-xl">
          <div className="px-3 pt-2 pb-1.5 text-sm text-ink-soft">מה לייצא?</div>
          {options.map((o) => (
            <button
              key={o.kind}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-sunk disabled:opacity-60"
              onClick={() => run(o)}
              disabled={busy !== null}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand">
                {busy === o.kind ? <LoaderCircle size={20} className="animate-spin" /> : o.icon}
              </span>
              <span>
                <span className="block font-medium">{o.title}</span>
                <span className="num block text-sm text-ink-soft">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
