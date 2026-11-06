import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { api } from '../api'
import { useLoad } from '../hooks/hooks'
import {
  addDays,
  cycleFor,
  cycleRangeText,
  cycleTitle,
  dayKey,
  dayRange,
  formatDate,
  HEB_WEEKDAYS,
  startOfDay,
  yearRange,
  type Range,
} from '../lib/time'
import { hebrewDate } from '../lib/hebrew'
import { DaysTable } from './DaysTable'
import { YearTable } from './YearTable'
import { ExportMenu } from './ExportMenu'
import { AddEntryDialog } from './AddEntryDialog'
import { PeriodPicker } from './PeriodPicker'

export type Mode = 'day' | 'month' | 'year'

const MODES: { id: Mode; label: string }[] = [
  { id: 'day', label: 'יום' },
  { id: 'month', label: 'חודש' },
  { id: 'year', label: 'שנה' },
]

export function rangeFor(mode: Mode, anchor: Date, startDay: number): Range {
  if (mode === 'day') return dayRange(anchor)
  if (mode === 'month') return cycleFor(anchor, startDay)
  return yearRange(cycleFor(anchor, startDay).labelYear, startDay)
}

export function Records({
  startDay,
  userName,
  version,
  onChanged,
}: {
  startDay: number
  userName: string
  version: number
  onChanged: () => void
}) {
  const [mode, setMode] = useState<Mode>('month')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [adding, setAdding] = useState(false)

  const range = useMemo(() => rangeFor(mode, anchor, startDay), [mode, anchor, startDay])
  const cycle = cycleFor(anchor, startDay)
  const year = cycle.labelYear

  const data = useLoad(
    async () => {
      const [sessions, notes] = await Promise.all([
        api.listSessions(range.start, range.end),
        api.listNotes(dayKey(range.start), dayKey(range.end)),
      ])
      return { sessions, notes }
    },
    [range, version],
  )

  function move(dir: -1 | 1) {
    if (mode === 'day') setAnchor(addDays(anchor, dir))
    else if (mode === 'month') setAnchor(dir < 0 ? addDays(cycle.start, -1) : cycle.end)
    else setAnchor(new Date(year + dir, 5, 15))
  }

  let title: string
  let subtitle: string
  if (mode === 'day') {
    title = `יום ${HEB_WEEKDAYS[anchor.getDay()]}, ${formatDate(anchor)}`
    subtitle = hebrewDate(anchor)
  } else if (mode === 'month') {
    title = cycleTitle(cycle)
    subtitle = cycleRangeText(cycle)
  } else {
    title = String(year)
    subtitle = `${formatDate(range.start)} – ${formatDate(addDays(range.end, -1))}`
  }

  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div role="tablist" aria-label="תצוגה" className="flex rounded-xl border border-line bg-surface p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`h-9 min-w-[72px] rounded-lg px-4 font-medium transition-colors ${
                mode === m.id ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="הקודם">
            <ChevronRight size={22} />
          </button>
          <PeriodPicker mode={mode} anchor={anchor} startDay={startDay} onPick={setAnchor}>
            <div className="font-display text-[22px] leading-tight font-semibold">{title}</div>
            <div className="text-sm text-ink-soft">{subtitle}</div>
          </PeriodPicker>
          <button className="icon-btn" onClick={() => move(1)} aria-label="הבא">
            <ChevronLeft size={22} />
          </button>
          <button className="btn btn-ghost ms-2 h-9 px-3 text-sm" onClick={() => setAnchor(startOfDay(new Date()))}>
            {mode === 'day' ? 'להיום' : mode === 'month' ? 'לחודש הנוכחי' : 'לשנה הנוכחית'}
          </button>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <button className="btn btn-ghost bg-surface" onClick={() => setAdding(true)}>
            <Plus size={18} />
            הוספת רישום
          </button>
          <ExportMenu anchor={anchor} startDay={startDay} userName={userName} mode={mode} />
        </div>
      </div>

      {data.error && !data.data && (
        <div className="rounded-2xl border border-stop/30 bg-stop-tint px-6 py-5 text-stop">
          לא הצלחנו לטעון את הנתונים: {data.error}
          <button className="btn btn-ghost ms-4 h-8 bg-surface text-sm" onClick={() => void data.reload()}>
            ניסיון נוסף
          </button>
        </div>
      )}

      {data.data &&
        (mode === 'year' ? (
          <YearTable
            year={year}
            startDay={startDay}
            sessions={data.data.sessions}
            onOpenMonth={(c) => {
              setAnchor(c.start)
              setMode('month')
            }}
          />
        ) : (
          <DaysTable
            mode={mode}
            range={range}
            sessions={data.data.sessions}
            notes={data.data.notes}
            onChanged={onChanged}
            onOpenDay={(d) => {
              setAnchor(d)
              setMode('day')
            }}
          />
        ))}

      {!data.data && !data.error && <div className="h-64 animate-pulse rounded-2xl bg-surface/60" />}

      {adding && (
        <AddEntryDialog
          defaultDay={mode === 'day' ? anchor : startOfDay(new Date())}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            onChanged()
          }}
        />
      )}
    </section>
  )
}
