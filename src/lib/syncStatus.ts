// מצב החיבור והסנכרון, כדי שהמסכים יוכלו להציג אותו.
// במצב הדגמה הוא תמיד "מחובר", כי אין שרת.

import { useSyncExternalStore } from 'react'

export interface SyncStatus {
  /** אין חיבור לשרת כרגע */
  offline: boolean
  /** כמה רישומים שמורים במחשב ועוד לא נשלחו */
  pending: number
  /** שליחה לשרת מתבצעת עכשיו */
  syncing: boolean
  /** בעיה שמונעת שליחה של רישום (לא בעיית חיבור) */
  problem: string | null
  /** הכל נשלח הרגע. מוצג לכמה שניות. */
  synced: boolean
}

let status: SyncStatus = {
  offline: typeof navigator !== 'undefined' && navigator.onLine === false,
  pending: 0,
  syncing: false,
  problem: null,
  synced: false,
}
const subs = new Set<() => void>()

export const getSyncStatus = () => status

export function setSyncStatus(patch: Partial<SyncStatus>) {
  const next = { ...status, ...patch }
  if ((Object.keys(next) as (keyof SyncStatus)[]).every((k) => next[k] === status[k])) return
  status = next
  subs.forEach((f) => f())
}

export function subscribeSyncStatus(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
}

// הודעה למסכים לטעון נתונים מחדש: אחרי שליחה, או כשהחיבור חזר
const dataSubs = new Set<() => void>()

export function onDataChanged(f: () => void) {
  dataSubs.add(f)
  return () => {
    dataSubs.delete(f)
  }
}

export function emitDataChanged() {
  dataSubs.forEach((f) => f())
}
