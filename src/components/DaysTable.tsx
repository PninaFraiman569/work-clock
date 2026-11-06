import { useState } from 'react'
import { Check, CornerDownLeft, CornerUpRight, NotebookPen, Plus, Trash2, X } from 'lucide-react'
import { api, type DayNote, type WorkSession } from '../api'
import { useNow } from '../hooks/hooks'
import {
  addDays,
  atTime,
  dayKey,
  formatDate,
  formatDuration,
  formatTime,
  groupByDay,
  HEB_WEEKDAYS,
  parseDayKey,
  piecesInRange,
  sumMs,
  type Piece,
  type Range,
} from '../lib/time'
import { hebrewDayMonth } from '../lib/hebrew'
import { resolveEntry } from '../lib/entry'
import { normalizeTime, TextCell, TimeField, TimeInput } from './TimeInput'
import { toast, toastError } from './Toaster'

export function DaysTable({
  mode,
  range,
  sessions,
  notes,
  onChanged,
  onOpenDay,
}: {
  mode: 'day' | 'month'
  range: Range
  sessions: WorkSession[]
  notes: DayNote[]
  onChanged: () => void
  onOpenDay: (d: Date) => void
}) {
  const now = useNow(20_000)
  const pieces = piecesInRange(sessions, range, now)
  const byDay = groupByDay(pieces)
  const noteMap = new Map(notes.map((n) => [n.day, n.note]))

  const days =
    mode === 'day'
      ? [dayKey(range.start)]
      : Array.from(new Set([...byDay.keys(), ...noteMap.keys()])).sort()

  const total = sumMs(pieces)
  const workedDays = byDay.size

  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
      <table className="w-full border-collapse text-[16px]">
        <colgroup>
          <col className="w-[200px]" />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col className="w-[90px]" />
          <col />
          <col className="w-[64px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line bg-sunk text-start text-sm text-ink-soft">
            <th className="px-6 py-3 text-start font-medium">תאריך</th>
            <th className="px-3 py-3 text-start font-medium">התחלה</th>
            <th className="px-3 py-3 text-start font-medium">סיום</th>
            <th className="px-3 py-3 text-start font-medium">משך</th>
            <th className="px-3 py-3 text-start font-medium">מה עשיתי</th>
            <th />
          </tr>
        </thead>

        {days.length === 0 && (
          <tbody>
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center">
                <div className="font-display text-xl font-medium">אין עדיין רישומים בחודש הזה</div>
                <div className="mt-1 text-ink-soft">אפשר להתחיל את השעון למעלה, או להוסיף רישום ידני.</div>
              </td>
            </tr>
          </tbody>
        )}

        {days.map((key) => (
          <DayBlock
            key={key}
            dayKeyStr={key}
            pieces={byDay.get(key) ?? []}
            note={noteMap.get(key) ?? ''}
            isToday={key === dayKey(now)}
            linkable={mode === 'month'}
            onOpen={() => onOpenDay(parseDayKey(key))}
            onChanged={onChanged}
          />
        ))}

        {mode === 'month' && days.length > 0 && (
          <tfoot>
            <tr className="bg-ink text-white">
              <td className="px-6 py-4 font-display text-lg font-medium">סה״כ בחודש</td>
              <td colSpan={2} className="px-3 py-4 text-white/70">
                {workedDays} ימי עבודה
              </td>
              <td className="num px-3 py-4 text-xl font-semibold" dir="ltr" style={{ textAlign: 'right' }}>
                {formatDuration(total)}
              </td>
              <td colSpan={2} className="px-3 py-4 text-white/70">
                ממוצע ליום עבודה: <span className="num">{formatDuration(workedDays ? total / workedDays : 0)}</span>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function DayBlock({
  dayKeyStr,
  pieces,
  note,
  isToday,
  linkable,
  onOpen,
  onChanged,
}: {
  dayKeyStr: string
  pieces: Piece[]
  note: string
  isToday: boolean
  linkable: boolean
  onOpen: () => void
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const day = parseDayKey(dayKeyStr)
  const total = sumMs(pieces)
  const rows = pieces.length + (adding ? 1 : 0) + (pieces.length === 0 && !adding ? 1 : 0) + 1

  const saveNote = async (v: string) => {
    try {
      await api.saveNote(dayKeyStr, v)
      onChanged()
    } catch (e) {
      toastError(e)
    }
  }

  const dateCell = (
    <td rowSpan={rows} className="border-e border-line px-6 py-4 align-top">
      <div className="sticky top-4">
        <button
          type="button"
          disabled={!linkable}
          onClick={onOpen}
          className={`block text-start ${linkable ? 'cursor-pointer hover:text-brand' : 'cursor-default'}`}
          title={linkable ? 'פתיחת היום' : undefined}
        >
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold">{HEB_WEEKDAYS[day.getDay()]}</span>
            {isToday && <span className="rounded-md bg-live-tint px-1.5 py-0.5 text-xs font-medium text-live">היום</span>}
          </div>
          <div className="num text-[15px] text-ink-soft">{formatDate(day)}</div>
          <div className="text-[15px] text-ink-soft">{hebrewDayMonth(day)}</div>
        </button>
        {pieces.length > 0 && (
          <div className="num mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-tint px-2.5 py-1 font-medium text-brand" dir="ltr">
            {formatDuration(total)}
          </div>
        )}
      </div>
    </td>
  )

  return (
    <tbody className="border-b border-line last:border-b-0">
      {pieces.map((p, i) => (
        <SegmentRow key={p.session.id + p.day} piece={p} first={i === 0} dateCell={i === 0 ? dateCell : null} onChanged={onChanged} />
      ))}

      {pieces.length === 0 && !adding && (
        <tr>
          {dateCell}
          <td colSpan={5} className="px-3 py-4 text-ink-soft">
            לא נרשמו שעות ביום הזה.
          </td>
        </tr>
      )}

      {adding && (
        <NewSegmentRow
          day={day}
          dateCell={pieces.length === 0 ? dateCell : null}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            onChanged()
          }}
        />
      )}

      <tr>
        <td colSpan={5} className="px-3 pt-1 pb-3">
          <div className="flex items-center gap-3">
            {!adding && (
              <button className="btn h-8 shrink-0 rounded-lg px-2.5 text-sm text-brand hover:bg-brand-tint" onClick={() => setAdding(true)}>
                <Plus size={16} />
                מקטע
              </button>
            )}
            <div className="flex flex-1 items-center gap-1.5 text-note">
              <NotebookPen size={16} className="shrink-0 opacity-70" />
              <TextCell
                value={note}
                onCommit={saveNote}
                placeholder="הערה ליום (לא חובה)"
                label={`הערה ליום ${formatDate(day)}`}
                className="text-[15px] text-note!"
              />
            </div>
          </div>
        </td>
      </tr>
    </tbody>
  )
}

function SegmentRow({
  piece,
  first,
  dateCell,
  onChanged,
}: {
  piece: Piece
  first: boolean
  dateCell: React.ReactNode
  onChanged: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const s = piece.session
  const pieceDay = parseDayKey(piece.day)
  const sessionStart = new Date(s.start_at)

  async function update(patch: Partial<WorkSession>, msg?: string) {
    try {
      await api.updateSession(s.id, patch)
      if (msg) toast(msg)
      onChanged()
    } catch (e) {
      toastError(e)
      onChanged()
    }
  }

  function commitStart(v: string) {
    const d = atTime(pieceDay, v)
    if (!d) return
    void update({ start_at: d.toISOString() }, 'שעת ההתחלה עודכנה')
  }

  function commitEnd(v: string) {
    let d = atTime(pieceDay, v)
    if (!d) return
    if (d <= sessionStart) d = atTime(addDays(pieceDay, 1), v)!
    void update({ end_at: d.toISOString() }, 'שעת הסיום עודכנה')
  }

  async function remove() {
    try {
      await api.deleteSession(s.id)
      toast('הרישום נמחק')
      onChanged()
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <tr className={`group ${first ? '' : 'border-t border-line/60'} ${piece.running ? 'bg-live-tint/50' : 'hover:bg-sunk/60'}`}>
      {dateCell}
      <td className="px-2 py-1.5 align-middle">
        {piece.continuesFromPrev ? (
          <Fixed time="00:00" hint="ההמשך של רישום שהתחיל ביום הקודם" icon={<CornerUpRight size={14} />} />
        ) : (
          <TimeInput value={formatTime(piece.start)} onCommit={commitStart} label="שעת התחלה" />
        )}
      </td>
      <td className="px-2 py-1.5 align-middle">
        {piece.running && !piece.continuesToNext ? (
          <span className="inline-flex items-center gap-2 px-2 font-medium text-live">
            <span className="live-dot" />
            פעיל
          </span>
        ) : piece.continuesToNext ? (
          <Fixed time="24:00" hint="הרישום ממשיך ליום הבא" icon={<CornerDownLeft size={14} />} />
        ) : (
          <TimeInput value={formatTime(piece.end)} onCommit={commitEnd} label="שעת סיום" />
        )}
      </td>
      <td className="num px-3 py-1.5 align-middle font-medium" dir="ltr" style={{ textAlign: 'right' }}>
        {piece.running ? <LiveDuration from={piece.start} /> : formatDuration(piece.ms)}
      </td>
      <td className="px-2 py-1.5 align-middle">
        <TextCell
          value={s.description}
          onCommit={(v) => void update({ description: v })}
          placeholder="מה עשיתי בשעות האלה?"
          label="מה עשיתי"
        />
      </td>
      <td className="px-2 py-1.5 align-middle">
        {confirming ? (
          <div className="flex items-center gap-0.5">
            <button className="icon-btn size-8 text-stop hover:bg-stop-tint hover:text-stop" onClick={remove} aria-label="אישור מחיקה" title="מחיקה">
              <Check size={17} />
            </button>
            <button className="icon-btn size-8" onClick={() => setConfirming(false)} aria-label="ביטול">
              <X size={17} />
            </button>
          </div>
        ) : (
          <button
            className="icon-btn opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-stop-tint hover:text-stop"
            onClick={() => setConfirming(true)}
            aria-label="מחיקת הרישום"
            title="מחיקת הרישום"
          >
            <Trash2 size={17} />
          </button>
        )}
      </td>
    </tr>
  )
}

function Fixed({ time, hint, icon }: { time: string; hint: string; icon: React.ReactNode }) {
  return (
    <span className="num inline-flex items-center gap-1.5 px-2 text-ink-soft" title={hint}>
      <span dir="ltr">{time}</span>
      <span className="text-ink-faint">{icon}</span>
    </span>
  )
}

function LiveDuration({ from }: { from: Date }) {
  const now = useNow(1000)
  return <>{formatDuration(now.getTime() - from.getTime())}</>
}

function NewSegmentRow({
  day,
  dateCell,
  onCancel,
  onSaved,
}: {
  day: Date
  dateCell: React.ReactNode
  onCancel: () => void
  onSaved: () => void
}) {
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const ns = normalizeTime(start)
  const ne = normalizeTime(end)
  const entry = ns && ne ? resolveEntry(day, ns, ne) : null

  async function save() {
    if (!entry) {
      toast('צריך למלא שעת התחלה ושעת סיום.', 'error')
      return
    }
    setBusy(true)
    try {
      await api.createSession({ start_at: entry.start.toISOString(), end_at: entry.end.toISOString(), description: desc.trim() })
      toast('הרישום נוסף')
      onSaved()
    } catch (e) {
      toastError(e)
      setBusy(false)
    }
  }

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void save()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <tr className="bg-brand-tint/40">
      {dateCell}
      <td className="px-2 py-2">
        <TimeField className="cell-input time-input border-line! bg-surface!" value={start} onChange={setStart} onKeyDown={keys} aria-label="שעת התחלה" />
      </td>
      <td className="px-2 py-2">
        <TimeField autoFocus className="cell-input time-input border-line! bg-surface!" value={end} onChange={setEnd} onKeyDown={keys} aria-label="שעת סיום" />
      </td>
      <td className="num px-3 py-2 text-ink-soft" dir="ltr" style={{ textAlign: 'right' }}>
        {entry ? formatDuration(entry.end.getTime() - entry.start.getTime()) : '–'}
        {entry?.overnight && <div className="text-xs">עד מחר</div>}
      </td>
      <td className="px-2 py-2">
        <input className="cell-input border-line! bg-surface!" placeholder="מה עשיתי בשעות האלה?" value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={keys} aria-label="מה עשיתי" />
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-0.5">
          <button className="icon-btn size-8 bg-brand text-white hover:bg-brand-deep hover:text-white" onClick={save} disabled={busy} aria-label="שמירה" title="שמירה">
            <Check size={17} />
          </button>
          <button className="icon-btn size-8" onClick={onCancel} aria-label="ביטול" title="ביטול">
            <X size={17} />
          </button>
        </div>
      </td>
    </tr>
  )
}
