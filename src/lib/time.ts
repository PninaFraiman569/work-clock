// חישובי זמן: ימים, מחזורים, פיצול מקטעים בחצות ועיצוב משכים.
// כל החישובים לפי השעון המקומי של הדפדפן (שעון ישראל).

import type { WorkSession } from '../api/types'

export const DAY_MS = 86_400_000

export const HEB_WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
export const HEB_WEEKDAYS_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", 'ש']
export const HEB_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** מפתח יום בפורמט yyyy-MM-dd לפי השעון המקומי */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b)
}

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatDateShort(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

/** משך בפורמט H:MM:SS (למשל 7:36:05), גם מעל 24 שעות. מעוגל לשנייה הקרובה, כמו התצוגה באקסל */
export function formatDuration(ms: number): string {
  const s = Math.round(Math.max(0, ms) / 1000)
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** משך בפורמט HH:MM:SS לשעון העצר */
export function formatClock(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

// ---------- מחזורים ----------

export interface Range {
  start: Date // כולל
  end: Date // לא כולל
}

export interface Cycle extends Range {
  /** החודש שבו המחזור מסתיים, לפיו הוא נקרא (מחזור נובמבר = 27/10 עד 26/11) */
  labelYear: number
  labelMonth: number // 0-11
  /** החודש הראשון אחרי שינוי הגדרה: הוא ארוך או קצר מהרגיל */
  transition: boolean
}

/**
 * לוח המחזורים של משתמש: היום שבו החודש מתחיל, ושינויים שנכנסים לתוקף מחודש מסוים.
 * כל מחזור מסתיים לפי ההגדרה שתקפה לו, ומתחיל ביום שאחרי סוף המחזור הקודם.
 * כך שינוי לא משפיע אחורה, ואין ימים כפולים או חסרים.
 */
export interface CycleSchedule {
  baseDay: number
  rules: { fromIndex: number; startDay: number }[] // ממוין לפי החודש
}

export const fixedSchedule = (day: number): CycleSchedule => ({ baseDay: day, rules: [] })

/** מספר רץ של חודש, לחישובים */
export const monthIndex = (year: number, month: number) => year * 12 + month

export function startDayAt(schedule: CycleSchedule, index: number): number {
  let day = schedule.baseDay
  for (const rule of schedule.rules) {
    if (rule.fromIndex > index) break
    day = rule.startDay
  }
  return day
}

/** הלוח אחרי בחירת הגדרה חדשה מחודש מסוים. מחליף שינויים שעוד לא נכנסו לתוקף. */
export function withRule(schedule: CycleSchedule, fromIndex: number, startDay: number): CycleSchedule {
  return { baseDay: schedule.baseDay, rules: [...schedule.rules.filter((r) => r.fromIndex < fromIndex), { fromIndex, startDay }] }
}

function lastDayAt(schedule: CycleSchedule, index: number): Date {
  const year = Math.floor(index / 12)
  const month = index - year * 12
  const day = startDayAt(schedule, index)
  return day === 1 ? new Date(year, month + 1, 0) : new Date(year, month, day - 1)
}

/** המחזור שנקרא על שם החודש במספר הרץ index */
export function cycleAtIndex(schedule: CycleSchedule, index: number): Cycle {
  const last = lastDayAt(schedule, index)
  return {
    start: addDays(lastDayAt(schedule, index - 1), 1),
    end: addDays(last, 1),
    labelYear: last.getFullYear(),
    labelMonth: last.getMonth(),
    transition: startDayAt(schedule, index) !== startDayAt(schedule, index - 1),
  }
}

/** המחזור שהתאריך שייך אליו */
export function cycleFor(date: Date, schedule: CycleSchedule): Cycle {
  const index = monthIndex(date.getFullYear(), date.getMonth())
  return startOfDay(date) <= lastDayAt(schedule, index) ? cycleAtIndex(schedule, index) : cycleAtIndex(schedule, index + 1)
}

/** המחזור שנקרא על שם חודש מסוים (החודש שבו הוא מסתיים) */
export function cycleByLabel(year: number, month: number, schedule: CycleSchedule): Cycle {
  return cycleAtIndex(schedule, monthIndex(year, month))
}

export function cycleTitle(c: Cycle): string {
  return `${HEB_MONTHS[c.labelMonth]} ${c.labelYear}`
}

export function cycleRangeText(c: Cycle): string {
  return `${formatDateShort(c.start)} – ${formatDateShort(addDays(c.end, -1))}`
}

/** שנה לועזית: כל המחזורים שמסתיימים בחודשים ינואר עד דצמבר של אותה שנה */
export function yearCycles(year: number, schedule: CycleSchedule): Cycle[] {
  return Array.from({ length: 12 }, (_, m) => cycleByLabel(year, m, schedule))
}

export function yearRange(year: number, schedule: CycleSchedule): Range {
  const cycles = yearCycles(year, schedule)
  return { start: cycles[0].start, end: cycles[11].end }
}

export function dayRange(d: Date): Range {
  const start = startOfDay(d)
  return { start, end: addDays(start, 1) }
}

// ---------- פיצול מקטעים לפי ימים ----------

export interface Piece {
  session: WorkSession
  day: string // yyyy-MM-dd
  start: Date
  end: Date
  ms: number
  /** המקטע התחיל ביום קודם (החלק הזה מתחיל בחצות) */
  continuesFromPrev: boolean
  /** המקטע ממשיך ליום הבא (החלק הזה מסתיים בחצות) */
  continuesToNext: boolean
  running: boolean
}

/** מפצל מקטע לחלקים לפי חצות. מקטע פעיל נחשב עד "עכשיו". */
export function splitSession(s: WorkSession, now: Date): Piece[] {
  const start = new Date(s.start_at)
  const running = !s.end_at
  const end = s.end_at ? new Date(s.end_at) : now
  const pieces: Piece[] = []
  if (end <= start) {
    return [{ session: s, day: dayKey(start), start, end: start, ms: 0, continuesFromPrev: false, continuesToNext: false, running }]
  }
  let cursor = start
  while (cursor < end) {
    const nextMidnight = addDays(startOfDay(cursor), 1)
    const pieceEnd = end < nextMidnight ? end : nextMidnight
    pieces.push({
      session: s,
      day: dayKey(cursor),
      start: cursor,
      end: pieceEnd,
      ms: pieceEnd.getTime() - cursor.getTime(),
      continuesFromPrev: cursor.getTime() !== start.getTime(),
      continuesToNext: pieceEnd.getTime() !== end.getTime(),
      running,
    })
    cursor = pieceEnd
  }
  return pieces
}

/** כל החלקים שנופלים בתוך הטווח, ממוינים לפי זמן */
export function piecesInRange(sessions: WorkSession[], range: Range, now: Date): Piece[] {
  const from = dayKey(range.start)
  const to = dayKey(range.end)
  return sessions
    .flatMap((s) => splitSession(s, now))
    .filter((p) => p.day >= from && p.day < to)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function sumMs(pieces: Piece[]): number {
  return pieces.reduce((acc, p) => acc + p.ms, 0)
}

/** קיבוץ חלקים לפי יום */
export function groupByDay(pieces: Piece[]): Map<string, Piece[]> {
  const map = new Map<string, Piece[]>()
  for (const p of pieces) {
    const list = map.get(p.day)
    if (list) list.push(p)
    else map.set(p.day, [p])
  }
  return map
}

/** הופך "HH:MM" ותאריך בסיס ל-Date */
export function atTime(day: Date, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min)
}
