import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Play, Square } from 'lucide-react'
import { api, type WorkSession } from '../api'
import { useNow } from '../hooks/hooks'
import {
  addDays,
  cycleRangeText,
  cycleTitle,
  dayRange,
  formatClock,
  formatDuration,
  formatTime,
  groupByDay,
  piecesInRange,
  startOfDay,
  sumMs,
  type Cycle,
} from '../lib/time'
import { DayRibbon } from './DayRibbon'
import { toast, toastError } from './Toaster'

const LONG_RUN_MS = 14 * 3_600_000

export function ClockHero({
  sessions,
  running,
  cycle,
  loaded,
  onChanged,
}: {
  sessions: WorkSession[]
  running: WorkSession | null
  cycle: Cycle
  loaded: boolean
  onChanged: () => void
}) {
  const now = useNow(1000)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')

  const today = startOfDay(now)
  const todayPieces = piecesInRange(sessions, dayRange(today), now)
  const yesterdayMs = sumMs(piecesInRange(sessions, dayRange(addDays(today, -1)), now))
  const cyclePieces = piecesInRange(sessions, cycle, now)
  const cycleDays = groupByDay(cyclePieces).size
  const elapsed = running ? now.getTime() - new Date(running.start_at).getTime() : 0

  async function start() {
    setBusy(true)
    try {
      await api.startSession(draft.trim())
      setDraft('')
      toast('השעון התחיל')
      onChanged()
    } catch (e) {
      toastError(e)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    if (!running) return
    setBusy(true)
    try {
      await api.stopSession(running.id)
      toast(`נרשמו ${formatDuration(elapsed)} שעות`)
      onChanged()
    } catch (e) {
      toastError(e)
    } finally {
      setBusy(false)
    }
  }

  const [hh, mm, ss] = formatClock(elapsed).split(':')

  return (
    <section className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_1px_0_#dde2ec,0_24px_48px_-28px_rgb(30_42_90/0.25)]">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        <div className="px-10 pt-9 pb-8">
          <div className="flex h-7 items-center gap-2.5 text-[17px]">
            {running ? (
              <>
                <span className="live-dot" />
                <span className="font-medium text-live">בעבודה מאז {formatTime(new Date(running.start_at))}</span>
              </>
            ) : (
              <span className="text-ink-soft">{loaded ? 'לא בעבודה כרגע' : ' '}</span>
            )}
          </div>

          <div
            dir="ltr"
            className={`num mt-3 flex items-baseline justify-end leading-none font-medium tracking-[-0.03em] ${
              running ? 'text-ink' : 'text-ink/25'
            }`}
            aria-label={`זמן שעבר: ${hh} שעות ${mm} דקות`}
          >
            <span className="text-[112px]">{hh}</span>
            <span className="mx-1 text-[96px] opacity-40">:</span>
            <span className="text-[112px]">{mm}</span>
            <span className={`ms-3 text-[48px] ${running ? 'text-ink-faint' : ''}`}>{ss}</span>
          </div>

          <div className="mt-8 flex items-stretch gap-3">
            {running ? (
              <RunningDescription key={running.id} session={running} />
            ) : (
              <input
                className="field h-14 flex-1 text-[17px]"
                placeholder="על מה עובדים? (לא חובה)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && loaded && void start()}
                aria-label="תיאור העבודה"
              />
            )}
            {running ? (
              <button onClick={stop} disabled={busy} className="btn h-14 min-w-[200px] rounded-2xl bg-stop px-7 text-lg text-white hover:bg-[#c23549]">
                {busy ? <LoaderCircle className="animate-spin" /> : <Square size={18} fill="currentColor" />}
                סיום עבודה
              </button>
            ) : (
              <button onClick={start} disabled={busy || !loaded} className="btn btn-primary h-14 min-w-[200px] rounded-2xl px-7 text-lg">
                {busy ? <LoaderCircle className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                התחלת עבודה
              </button>
            )}
          </div>

          {running && elapsed > LONG_RUN_MS && (
            <p className="mt-4 rounded-xl bg-note-tint px-4 py-3 text-[15px] text-note">
              השעון רץ כבר יותר מ-14 שעות. אם שכחת לעצור, אפשר לסיים ולתקן את שעת הסיום בטבלה למטה.
            </p>
          )}
        </div>

        <aside className="grid grid-cols-3 border-t border-line bg-sunk lg:grid-cols-1 lg:border-t-0 lg:border-s">
          <Stat title="היום" value={formatDuration(sumMs(todayPieces))} live={!!running} />
          <Stat title="אתמול" value={formatDuration(yesterdayMs)} />
          <Stat
            title={`מחזור ${cycleTitle(cycle)}`}
            value={formatDuration(sumMs(cyclePieces))}
            sub={`${cycleRangeText(cycle)}, ${cycleDays} ימי עבודה`}
          />
        </aside>
      </div>

      <DayRibbon pieces={todayPieces} now={now} />
    </section>
  )
}

function Stat({ title, value, sub, live }: { title: string; value: string; sub?: string; live?: boolean }) {
  return (
    <div className="flex flex-col justify-center border-line px-2 py-5 not-last:border-e sm:px-3 md:px-8 lg:not-last:border-e-0 lg:not-last:border-b">
      <div className="flex items-center gap-2 text-[15px] text-ink-soft">
        {title}
        {live && <span className="size-1.5 rounded-full bg-live" />}
      </div>
      <div className="num mt-1 text-[17px] leading-tight font-medium sm:text-[22px] md:text-[34px]" dir="ltr" style={{ textAlign: 'right' }}>
        {value}
      </div>
      {sub && <div className="text-sm text-ink-soft">{sub}</div>}
    </div>
  )
}

/** תיאור לרישום הפעיל: נשמר אוטומטית תוך כדי הקלדה */
function RunningDescription({ session }: { session: WorkSession }) {
  const [value, setValue] = useState(session.description)
  const saved = useRef(session.description)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const save = (v: string) => {
    clearTimeout(timer.current)
    if (v === saved.current) return
    saved.current = v
    api.updateSession(session.id, { description: v }).catch(toastError)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <input
      className="field h-14 flex-1 text-[17px]"
      placeholder="על מה עובדים עכשיו?"
      value={value}
      onChange={(e) => {
        const v = e.target.value
        setValue(v)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => save(v), 700)
      }}
      onBlur={() => save(value)}
      aria-label="תיאור העבודה הנוכחית"
    />
  )
}
