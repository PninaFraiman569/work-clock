// הגדרת חודש: בניית הלוח מההיסטוריה, תיאור שינוי לפני אישור, ושורות ההיסטוריה.

import type { CycleHistory } from '../api/types'
import {
  addDays,
  cycleAtIndex,
  cycleFor,
  fixedSchedule,
  formatDate,
  HEB_MONTHS,
  monthIndex,
  parseDayKey,
  startDayAt,
  startOfDay,
  cycleTitle,
  withRule,
  type Cycle,
  type CycleSchedule,
} from './time'

export function scheduleFromHistory(profileDay: number, history: CycleHistory): CycleSchedule {
  const changes = [...history.changes].sort((a, b) => a.effective_month.localeCompare(b.effective_month))
  if (changes.length === 0) return fixedSchedule(profileDay)
  return {
    baseDay: changes[0].old_start_day,
    rules: changes.map((c) => {
      const d = parseDayKey(c.effective_month)
      return { fromIndex: monthIndex(d.getFullYear(), d.getMonth()), startDay: c.new_start_day }
    }),
  }
}

export const cycleIndex = (c: Cycle) => monthIndex(c.labelYear, c.labelMonth)
const lastDay = (c: Cycle) => addDays(c.end, -1)
const rangeText = (from: Date, to: Date) => `${formatDate(from)} עד ${formatDate(to)}`
/** תאריך בלי שנה, למשל 13/12 */
const shortDate = (d: Date) => formatDate(d).slice(0, 5)
const shortRange = (from: Date, to: Date) => `${shortDate(from)} עד ${shortDate(to)}`
const monthName = (c: Cycle) => HEB_MONTHS[c.labelMonth]

/** למשל: "מה-27 עד ה-26 בחודש הבא", או "מה-1 עד סוף החודש" */
export function dayRuleText(day: number): string {
  return day === 1 ? 'מה-1 עד סוף החודש' : `מה-${day} עד ה-${day - 1} בחודש הבא`
}

function ruleLabel(day: number): string {
  return day === 1 ? 'מתחיל ב-1, מסתיים בסוף החודש' : `מתחיל ב-${day}, מסתיים ב-${day - 1}`
}

/** הימים שמצטרפים לחודש מעבר ארוך. ריק כשהחודש קצר מהרגיל. */
function joinedDays(schedule: CycleSchedule, index: number): { from: Date; to: Date; count: number } | null {
  const cycle = cycleAtIndex(schedule, index)
  const normal = cycleAtIndex(fixedSchedule(startDayAt(schedule, index)), index)
  if (cycle.start >= normal.start) return null
  const to = addDays(normal.start, -1)
  return { from: cycle.start, to, count: Math.round((normal.start.getTime() - cycle.start.getTime()) / 86_400_000) }
}

/** המשפט על הימים שיוצאים מחודש מעבר קצר ונספרים בחודש הבא. ריק כשהחודש לא התקצר. */
function movedDaysText(schedule: CycleSchedule, index: number, past: boolean): string {
  const cycle = cycleAtIndex(schedule, index)
  const oldEnd = cycleAtIndex(fixedSchedule(startDayAt(schedule, index - 1)), index).end
  if (oldEnd <= cycle.end) return ''
  const to = addDays(oldEnd, -1)
  const next = monthName(cycleAtIndex(schedule, index + 1))
  if (to.getTime() === cycle.end.getTime()) {
    return `היום ${shortDate(to)} ${past ? 'נספר' : 'ייספר'} ב${next}.`
  }
  return `הימים ${shortRange(cycle.end, to)} ${past ? 'נספרו' : 'ייספרו'} ב${next}.`
}

/** ההסבר על שינוי שנכנס לתוקף בחודש index */
export function changeLines(schedule: CycleSchedule, index: number): string[] {
  const before = cycleAtIndex(schedule, index - 1)
  const transition = cycleAtIndex(schedule, index)
  const after = cycleAtIndex(schedule, index + 1)
  const joined = joinedDays(schedule, index)
  const range = rangeText(transition.start, lastDay(transition))
  const lines = [`חודש ${monthName(before)} נשאר כרגיל: ${rangeText(before.start, lastDay(before))}.`]
  if (joined) {
    const days = joined.count === 1 ? `היום ${formatDate(joined.from)} יצטרף` : `הימים ${rangeText(joined.from, joined.to)} יצטרפו`
    lines.push(`${days} ל${monthName(transition)}, ולכן חודש ${monthName(transition)} יהיה חודש מעבר: ${range}.`)
  } else {
    lines.push(`חודש ${monthName(transition)} יהיה חודש מעבר קצר מהרגיל: ${range}. ${movedDaysText(schedule, index, false)}`.trim())
  }
  lines.push(`חודש ${monthName(after)} יהיה ${rangeText(after.start, lastDay(after))}. מכאן והלאה כל חודש מתחיל ב-${startDayAt(schedule, index + 1)} ונקרא על שם החודש שבו הוא מסתיים.`)
  lines.push('חודשים קודמים לא ישתנו.')
  return lines
}

export type ChangePreview = { kind: 'cancel'; dayInForce: number } | { kind: 'change'; lines: string[] }

/** מה יקרה אם נבחר עכשיו ביום newDay. שינוי שעוד לא נכנס לתוקף מוחלף. */
export function previewChange(schedule: CycleSchedule, newDay: number, now: Date): ChangePreview {
  const currentIndex = cycleIndex(cycleFor(now, schedule))
  const dayInForce = startDayAt(schedule, currentIndex)
  if (newDay === dayInForce) return { kind: 'cancel', dayInForce }
  return { kind: 'change', lines: changeLines(withRule(schedule, currentIndex + 1, newDay), currentIndex + 1) }
}

export interface HistoryRow {
  key: string
  /** שם החודש או טווח החודשים. ריק כשאין תאריך התחלה ידוע. */
  title: string
  range: string
  text: string
  transition: boolean
  status: 'past' | 'current' | 'upcoming'
}

/** שורות ההיסטוריה, מהישנה לחדשה */
export function historyRows(schedule: CycleSchedule, since: string | null, now: Date): HistoryRow[] {
  const today = startOfDay(now)
  const rows: HistoryRow[] = []
  const status = (from: Date | null, to: Date | null): HistoryRow['status'] => {
    if (to && to < today) return 'past'
    if (from && from > today) return 'upcoming'
    return 'current'
  }
  const firstIndex = since ? cycleIndex(cycleFor(parseDayKey(since), schedule)) : null
  let cursor = firstIndex

  for (const rule of schedule.rules) {
    if (cursor === null || cursor < rule.fromIndex) {
      const from = cursor === null ? null : cycleAtIndex(schedule, cursor).start
      const lastCycle = cycleAtIndex(schedule, rule.fromIndex - 1)
      const to = lastDay(lastCycle)
      let title = `עד חודש ${monthName(lastCycle)}`
      if (cursor !== null) {
        title =
          cursor === rule.fromIndex - 1
            ? `חודש ${monthName(lastCycle)}`
            : `${cycleTitle(cycleAtIndex(schedule, cursor))} עד ${cycleTitle(lastCycle)}`
      }
      rows.push({
        key: `plain-${rule.fromIndex}`,
        title,
        range: from ? rangeText(from, to) : `עד ${formatDate(to)}`,
        text: ruleLabel(startDayAt(schedule, rule.fromIndex - 1)),
        transition: false,
        status: status(from, to),
      })
    }
    const cycle = cycleAtIndex(schedule, rule.fromIndex)
    const joined = joinedDays(schedule, rule.fromIndex)
    const name = monthName(cycle)
    const rowStatus = status(cycle.start, lastDay(cycle))
    rows.push({
      key: `transition-${rule.fromIndex}`,
      title: `חודש ${name}`,
      range: rangeText(cycle.start, lastDay(cycle)),
      text: joined
        ? `חודש מעבר. ${joined.count === 1 ? `היום ${shortDate(joined.from)} מצטרף` : `הימים ${shortRange(joined.from, joined.to)} מצטרפים`} ל${name}.`
        : `חודש מעבר, קצר מהרגיל. ${movedDaysText(schedule, rule.fromIndex, rowStatus === 'past')}`.trim(),
      transition: true,
      status: rowStatus,
    })
    cursor = rule.fromIndex + 1
  }

  const openCycle = cursor === null ? null : cycleAtIndex(schedule, cursor)
  const from = openCycle ? openCycle.start : null
  const rule = ruleLabel(startDayAt(schedule, cursor ?? monthIndex(today.getFullYear(), today.getMonth())))
  // בלי שורות קודמות החודש יכול להיות רחוק, ולכן השנה נכתבת
  const openName = openCycle ? (rows.length === 0 ? cycleTitle(openCycle) : monthName(openCycle)) : ''
  rows.push({
    key: 'open',
    title: openCycle ? `מחודש ${openName} ואילך` : '',
    range: from ? `החל מ-${formatDate(from)}` : 'ההגדרה הנוכחית',
    text: from ? `${rule}. כל חודש נקרא על שם החודש שבו הוא מסתיים.` : rule,
    transition: false,
    status: status(from, null),
  })
  return rows
}
