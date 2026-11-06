import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cycleByLabel, cycleFor, HEB_MONTHS, HEB_WEEKDAYS_SHORT, isSameDay, startOfDay } from '../lib/time'
import type { Mode } from './Records'

const YEARS_PER_PAGE = 12

/** כותרת לחיצה שפותחת בחירה לפי התצוגה: יום בלוח שנה, חודש מתוך שנה, או שנה */
export function PeriodPicker({
  mode,
  anchor,
  startDay,
  onPick,
  children,
}: {
  mode: Mode
  anchor: Date
  startDay: number
  onPick: (d: Date) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const pick = (d: Date) => {
    onPick(d)
    setOpen(false)
    trigger.current?.focus()
  }

  return (
    <div ref={wrapper} className="relative min-w-[210px]">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="בחירת תאריך"
        className="block w-full cursor-pointer rounded-xl px-2 text-center transition-colors hover:bg-surface"
      >
        {children}
        <ChevronDown size={14} aria-hidden className={`mx-auto text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="בחירת תאריך"
          className="modal-in absolute top-full left-1/2 z-30 mt-2 w-[19rem] -translate-x-1/2 rounded-2xl border border-line bg-surface p-3 shadow-xl"
        >
          {mode === 'day' && <DayPanel anchor={anchor} onPick={pick} />}
          {mode === 'month' && <MonthPanel anchor={anchor} startDay={startDay} onPick={pick} />}
          {mode === 'year' && <YearPanel anchor={anchor} startDay={startDay} onPick={pick} />}
        </div>
      )}
    </div>
  )
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="icon-btn size-8" onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  )
}

function DayPanel({ anchor, onPick }: { anchor: Date; onPick: (d: Date) => void }) {
  const [view, setView] = useState({ year: anchor.getFullYear(), month: anchor.getMonth() })
  const today = startOfDay(new Date())

  const moveMonth = (dir: -1 | 1) => {
    const d = new Date(view.year, view.month + dir, 1)
    setView({ year: d.getFullYear(), month: d.getMonth() })
  }
  const moveYear = (dir: -1 | 1) => setView({ ...view, year: view.year + dir })

  const blanks = new Date(view.year, view.month, 1).getDay()
  const count = new Date(view.year, view.month + 1, 0).getDate()

  return (
    <>
      <div className="mb-2 flex items-center">
        <NavButton label="שנה קודמת" onClick={() => moveYear(-1)}>
          <ChevronsRight size={18} />
        </NavButton>
        <NavButton label="חודש קודם" onClick={() => moveMonth(-1)}>
          <ChevronRight size={18} />
        </NavButton>
        <div className="flex-1 text-center font-display font-semibold" aria-live="polite">
          {HEB_MONTHS[view.month]} {view.year}
        </div>
        <NavButton label="חודש הבא" onClick={() => moveMonth(1)}>
          <ChevronLeft size={18} />
        </NavButton>
        <NavButton label="שנה הבאה" onClick={() => moveYear(1)}>
          <ChevronsLeft size={18} />
        </NavButton>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {HEB_WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="py-1 text-xs font-medium text-ink-faint">
            {w}
          </div>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = new Date(view.year, view.month, i + 1)
          const selected = isSameDay(d, anchor)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(d)}
              aria-pressed={selected}
              aria-current={isSameDay(d, today) ? 'date' : undefined}
              className={optionClass(selected, isSameDay(d, today), 'num h-9 text-[15px]')}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
    </>
  )
}

function MonthPanel({ anchor, startDay, onPick }: { anchor: Date; startDay: number; onPick: (d: Date) => void }) {
  const current = cycleFor(anchor, startDay)
  const now = cycleFor(new Date(), startDay)
  const [year, setYear] = useState(current.labelYear)

  return (
    <>
      <div className="mb-2 flex items-center">
        <NavButton label="שנה קודמת" onClick={() => setYear(year - 1)}>
          <ChevronRight size={18} />
        </NavButton>
        <div className="num flex-1 text-center font-semibold" aria-live="polite">
          {year}
        </div>
        <NavButton label="שנה הבאה" onClick={() => setYear(year + 1)}>
          <ChevronLeft size={18} />
        </NavButton>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {HEB_MONTHS.map((name, m) => {
          const selected = current.labelYear === year && current.labelMonth === m
          const isNow = now.labelYear === year && now.labelMonth === m
          return (
            <button
              key={name}
              type="button"
              onClick={() => onPick(cycleByLabel(year, m, startDay).start)}
              aria-pressed={selected}
              aria-current={isNow ? 'date' : undefined}
              className={optionClass(selected, isNow, 'h-11 text-[15px]')}
            >
              {name}
            </button>
          )
        })}
      </div>
    </>
  )
}

function YearPanel({ anchor, startDay, onPick }: { anchor: Date; startDay: number; onPick: (d: Date) => void }) {
  const current = cycleFor(anchor, startDay).labelYear
  const now = cycleFor(new Date(), startDay).labelYear
  const [first, setFirst] = useState(current - (current % YEARS_PER_PAGE))
  const last = first + YEARS_PER_PAGE - 1

  return (
    <>
      <div className="mb-2 flex items-center">
        <NavButton label="שנים קודמות" onClick={() => setFirst(first - YEARS_PER_PAGE)}>
          <ChevronRight size={18} />
        </NavButton>
        <div className="num flex-1 text-center font-semibold" dir="ltr" aria-live="polite">
          {first} – {last}
        </div>
        <NavButton label="שנים הבאות" onClick={() => setFirst(first + YEARS_PER_PAGE)}>
          <ChevronLeft size={18} />
        </NavButton>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: YEARS_PER_PAGE }, (_, i) => {
          const year = first + i
          return (
            <button
              key={year}
              type="button"
              // אמצע השנה נמצא תמיד במחזור שנקרא על שם אותה שנה, כמו בחיצים של תצוגת השנה
              onClick={() => onPick(new Date(year, 5, 15))}
              aria-pressed={year === current}
              aria-current={year === now ? 'date' : undefined}
              className={optionClass(year === current, year === now, 'num h-11 text-[15px]')}
            >
              {year}
            </button>
          )
        })}
      </div>
    </>
  )
}

function optionClass(selected: boolean, isNow: boolean, extra: string): string {
  const state = selected
    ? 'bg-brand font-semibold text-white'
    : isNow
      ? 'font-semibold text-brand ring-1 ring-brand ring-inset hover:bg-brand-tint'
      : 'text-ink hover:bg-brand-tint'
  return `cursor-pointer rounded-lg transition-colors ${state} ${extra}`
}
