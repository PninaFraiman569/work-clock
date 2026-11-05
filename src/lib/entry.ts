import { addDays, atTime } from './time'

/** הופך יום + שעות התחלה וסיום לטווח. אם שעת הסיום מוקדמת מההתחלה, הסיום הוא למחרת. */
export function resolveEntry(day: Date, start: string, end: string): { start: Date; end: Date; overnight: boolean } | null {
  const s = atTime(day, start)
  let e = atTime(day, end)
  if (!s || !e) return null
  let overnight = false
  if (e <= s) {
    e = atTime(addDays(day, 1), end)!
    overnight = true
  }
  return { start: s, end: e, overnight }
}
