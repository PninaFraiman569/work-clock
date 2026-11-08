// עבודה בלי אינטרנט.
// כל מה שנטען מהשרת נשמר גם במחשב, ומוצג משם כשאין חיבור.
// "התחלה", "סיום" ושינוי התיאור של השעון הפעיל נשמרים במחשב כשאין חיבור,
// ונשלחים לבד כשהחיבור חוזר. שאר הפעולות דורשות חיבור.
//
// כמה חלונות של האתר יכולים להיות פתוחים יחד (למשל התוכנה המותקנת וגם לשונית בדפדפן).
// לכן כל שינוי קורא את המצב העדכני מהמחשב וכותב אותו מיד, ורק חלון אחד שולח בכל רגע.

import { ApiError, NetworkError, type Api, type CycleHistory, type Profile, type WorkSession } from './types'
import { emitDataChanged, getSyncStatus, setSyncStatus } from '../lib/syncStatus'

export type SessionRow = Pick<WorkSession, 'id' | 'start_at' | 'end_at' | 'description'>

/** מה שהשכבה הזאת צריכה מהשרת, מעבר לממשק הרגיל */
export interface OfflineBackend extends Api {
  /** יצירת רישום עם מזהה ושעות שנקבעו מראש במחשב */
  putSession(row: SessionRow): Promise<WorkSession>
  /** המשתמש שההתחברות שלו שמורה במחשב, גם אם אי אפשר לחדש אותה כרגע */
  storedUserId(): string | null
}

type Patch = Partial<Pick<WorkSession, 'end_at' | 'description'>>

interface Store {
  v: 1
  profile: Profile | null
  history: CycleHistory | null
  /** עותק של הרישומים שנטענו מהשרת */
  sessions: Record<string, WorkSession>
  /** עותק של ההערות היומיות שנטענו, לפי יום */
  notes: Record<string, string>
  /** רישומים שנוצרו בלי חיבור ועוד לא נשלחו */
  created: Record<string, WorkSession>
  /** שינויים ברישומים קיימים שעוד לא נשלחו */
  patches: Record<string, Patch>
}

const LAST_USER = 'work-clock-last-user'
const STORE_PREFIX = 'work-clock-offline-v1:'
const storeKey = (uid: string) => STORE_PREFIX + uid
const RETRY_MS = 20_000
const SYNCED_FLASH_MS = 4_000
const ONE_RUNNING = 'כבר יש שעון פעיל. צריך לסיים אותו לפני שמתחילים חדש.'
const NEEDS_CONNECTION = 'אין חיבור לאינטרנט. עריכה של רישומים אפשרית רק כשיש חיבור.'

const emptyStore = (): Store => ({ v: 1, profile: null, history: null, sessions: {}, notes: {}, created: {}, patches: {} })

function readStore(uid: string): Store {
  try {
    const raw = localStorage.getItem(storeKey(uid))
    if (raw) {
      const s = JSON.parse(raw) as Store
      if (s.v === 1) return s
    }
  } catch {
    /* עותק פגום: מתחילים מחדש */
  }
  return emptyStore()
}

const countPending = (s: Store) => Object.keys(s.created).length + Object.keys(s.patches).length

/** הרישום חופף לטווח [from, to) */
function overlaps(s: WorkSession, from: Date, to: Date): boolean {
  return new Date(s.start_at) < to && (s.end_at === null || new Date(s.end_at) > from)
}

const byStart = (a: WorkSession, b: WorkSession) => a.start_at.localeCompare(b.start_at)
const samePatch = (a: Patch | undefined, b: Patch) => !!a && a.end_at === b.end_at && a.description === b.description
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** רק חלון אחד שולח בכל רגע. דפדפן בלי התמיכה הזאת פשוט שולח. */
function exclusive(fn: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined
  return locks ? locks.request('work-clock-sync', fn) : fn()
}

export function withOffline(base: OfflineBackend): Api {
  let uid: string | null = null
  let syncing: Promise<void> | null = null
  let flashTimer: ReturnType<typeof setTimeout> | undefined

  /** המצב העדכני מהמחשב. כל קריאה קוראת מחדש, כי חלון אחר אולי שינה אותו. */
  const read = (): Store | null => (uid ? readStore(uid) : null)

  /** קריאה, שינוי ושמירה מיידית, בלי המתנה באמצע */
  function mutate<T>(fn: (s: Store) => T): T | undefined {
    if (!uid) return undefined
    const s = readStore(uid)
    const out = fn(s)
    try {
      localStorage.setItem(storeKey(uid), JSON.stringify(s))
    } catch {
      /* אין מקום במחשב: מה שכבר נשמר נשאר */
    }
    setSyncStatus({ pending: countPending(s) })
    return out
  }

  const pendingCount = () => {
    const s = read()
    return s ? countPending(s) : 0
  }

  /** המשתמש המחובר. בלי חיבור Supabase לא מדווח עליו, ואז משתמשים במשתמש האחרון ששמור במחשב. */
  function resolveUser(id: string | null): string | null {
    if (id) return id
    const last = localStorage.getItem(LAST_USER)
    return last && base.storedUserId() === last ? last : null
  }

  function setUser(id: string | null) {
    uid = id
    if (id) localStorage.setItem(LAST_USER, id)
    setSyncStatus({ pending: pendingCount(), problem: null })
    if (id && pendingCount() > 0) void sync()
  }

  function markOffline() {
    setSyncStatus({ offline: true, synced: false })
  }

  function markOnline() {
    if (!getSyncStatus().offline) return
    setSyncStatus({ offline: false })
    if (pendingCount() > 0) void sync()
    else emitDataChanged()
  }

  /**
   * כשידוע שאין חיבור, קוראים ישר מהמחשב בלי לנסות את השרת:
   * בלי חיבור Supabase מנסה לחדש את ההתחברות שוב ושוב, וזה יכול לקחת חצי דקה.
   * הבדיקה אם החיבור חזר רצה ברקע (probe).
   */
  const knownOffline = () => getSyncStatus().offline

  /** בקשה לשרת שמעדכנת את מצב החיבור */
  async function net<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const res = await fn()
      markOnline()
      return res
    } catch (e) {
      if (e instanceof NetworkError) markOffline()
      // תשובת שגיאה מהשרת (עם קוד) אומרת שיש חיבור
      else if (e instanceof ApiError && e.code) markOnline()
      throw e
    }
  }

  /** הרישומים כפי שהם במחשב: עם השינויים שעוד לא נשלחו, ועם הרישומים החדשים שבטווח */
  function overlay(rows: WorkSession[], from: Date | null, to: Date | null): WorkSession[] {
    const s = read()
    if (!s) return rows
    const inRange = (x: WorkSession) => !from || !to || overlaps(x, from, to)
    const out = new Map<string, WorkSession>()
    for (const r of rows) {
      const p = s.patches[r.id]
      out.set(r.id, p ? { ...r, ...p, pending: true } : r)
    }
    for (const c of Object.values(s.created)) {
      if (out.has(c.id) || inRange(c)) out.set(c.id, { ...c, pending: true })
    }
    return [...out.values()].filter(inRange).sort(byStart)
  }

  const cachedIn = (s: Store, from: Date, to: Date) => Object.values(s.sessions).filter((x) => overlaps(x, from, to))
  const remember = (r: WorkSession) => mutate((s) => void (s.sessions[r.id] = r))

  /** שינוי ברישום: נשלח מיד כשיש חיבור, אחרת נשמר במחשב */
  async function change(id: string, patch: Patch): Promise<WorkSession> {
    if (!uid) return net(() => base.updateSession(id, patch))

    // רישום שנוצר בלי חיבור ועוד לא נשלח: משנים אותו במחשב
    const made = mutate((s) => {
      const m = s.created[id]
      if (m) Object.assign(m, patch)
      return m
    })
    if (made) {
      void sync()
      return { ...made, pending: true }
    }

    // אם כבר מחכה שינוי לרישום הזה, השינוי החדש מצטרף אליו כדי לשמור על הסדר
    if (!read()?.patches[id] && !getSyncStatus().offline) {
      try {
        const r = await net(() => base.updateSession(id, patch))
        remember(r)
        return r
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e
      }
    }

    const result = mutate((s) => {
      s.patches[id] = { ...s.patches[id], ...patch }
      const known = s.sessions[id]
      return known ? { ...known, ...s.patches[id], pending: true } : ({ id, ...s.patches[id], pending: true } as WorkSession)
    })!
    void sync()
    return result
  }

  /** שליחת כל מה שממתין */
  function sync(): Promise<void> {
    if (syncing) return syncing
    syncing = exclusive(sendPending).finally(() => {
      syncing = null
    })
    return syncing
  }

  async function sendPending(): Promise<void> {
    const snapshot = read()
    if (!snapshot || countPending(snapshot) === 0) {
      setSyncStatus({ pending: 0 })
      return
    }
    setSyncStatus({ syncing: true, synced: false })
    let problem: string | null = null
    let sent = 0
    let down = false

    // קודם השינויים ברישומים קיימים: למשל סיום של שעון שהתחיל עם חיבור,
    // כדי ששעון חדש שהתחיל בלי חיבור לא ייחשב כשעון פעיל שני
    for (const [id, patch] of Object.entries(snapshot.patches)) {
      try {
        const r = await net(() => base.updateSession(id, patch))
        mutate((s) => {
          s.sessions[id] = r
          // אם בינתיים נוסף שינוי (בחלון הזה או באחר), הוא יישלח בסבב הבא
          if (samePatch(s.patches[id], patch)) delete s.patches[id]
        })
        sent++
      } catch (e) {
        if (e instanceof NetworkError) {
          down = true
          break
        }
        if (e instanceof ApiError && e.code === 'PGRST116') {
          // הרישום נמחק בינתיים (למשל ממחשב אחר)
          mutate((s) => {
            delete s.patches[id]
            delete s.sessions[id]
          })
          problem = 'רישום ששונה בלי חיבור נמחק בינתיים, ולכן השינוי שלו לא נשמר.'
        } else {
          problem = errText(e)
        }
      }
    }

    if (!down) {
      for (const made of Object.values(snapshot.created).sort(byStart)) {
        const row: SessionRow = { id: made.id, start_at: made.start_at, end_at: made.end_at, description: made.description }
        let saved: WorkSession | null = null
        try {
          saved = await net(() => base.putSession(row))
        } catch (e) {
          if (e instanceof NetworkError) {
            down = true
            break
          }
          const raw = e instanceof ApiError ? (e.raw ?? '') : ''
          if (e instanceof ApiError && e.code === '23505' && /pkey/.test(raw)) {
            // כבר נשלח בפעם קודמת, אבל התשובה לא הגיעה: מעדכנים במקום ליצור שוב
            try {
              saved = await net(() => base.updateSession(row.id, { end_at: row.end_at, description: row.description }))
            } catch (e2) {
              if (e2 instanceof NetworkError) {
                down = true
                break
              }
              problem = errText(e2)
            }
          } else if (e instanceof ApiError && e.code === '23505') {
            problem = 'יש שעון פעיל שהתחיל ממחשב אחר. אחרי שיסתיים, הרישום מהמחשב הזה יישלח.'
          } else {
            problem = errText(e)
          }
        }
        if (saved) {
          const r = saved
          mutate((s) => {
            s.sessions[r.id] = r
            const now = s.created[r.id]
            delete s.created[r.id]
            // אם בינתיים הרישום השתנה (למשל נלחץ "סיום"), השינוי נשלח בסבב הבא
            if (now && (now.end_at !== row.end_at || now.description !== row.description)) {
              s.patches[r.id] = { end_at: now.end_at, description: now.description }
            }
          })
          sent++
        }
      }
    }

    const left = pendingCount()
    setSyncStatus({ syncing: false, pending: left, problem: down ? getSyncStatus().problem : problem })
    if (sent > 0) {
      if (left === 0 && !down) {
        setSyncStatus({ synced: true, problem: null })
        clearTimeout(flashTimer)
        flashTimer = setTimeout(() => setSyncStatus({ synced: false }), SYNCED_FLASH_MS)
      }
      emitDataChanged()
    }
    // שינוי שנוסף בזמן השליחה נשלח מיד, כל עוד אין בעיה
    if (!down && !problem && left > 0) setTimeout(() => void sync(), 0)
  }

  async function probe() {
    if (!uid) return
    if (pendingCount() > 0) return sync()
    try {
      await net(() => base.getRunning())
    } catch {
      /* עדיין אין חיבור */
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('offline', markOffline)
    window.addEventListener('online', () => void probe())
    // חלון אחר שמר משהו: מעדכנים את המסך הזה
    window.addEventListener('storage', (e: StorageEvent) => {
      if (uid && e.key === storeKey(uid)) {
        setSyncStatus({ pending: pendingCount() })
        emitDataChanged()
      }
    })
    setInterval(() => {
      if (uid && (getSyncStatus().offline || pendingCount() > 0)) void probe()
    }, RETRY_MS)
  }

  return {
    demo: base.demo,

    async currentUserId() {
      // בלי חיבור: אם יש התחברות שמורה במחשב, משתמשים בה מיד
      const quick = knownOffline() ? resolveUser(null) : null
      const id = quick ?? resolveUser(await base.currentUserId())
      setUser(id)
      return id
    },

    onAuthChange(cb) {
      return base.onAuthChange((id) => {
        const resolved = resolveUser(id)
        setUser(resolved)
        cb(resolved)
      })
    },

    signIn: (username, password) => net(() => base.signIn(username, password)),

    async signOut() {
      // יציאה מוחקת את מה שנשמר במחשב, כולל רישומים שלא נשלחו. המסך מזהיר לפני כן.
      if (uid) localStorage.removeItem(storeKey(uid))
      localStorage.removeItem(LAST_USER)
      uid = null
      setSyncStatus({ pending: 0, problem: null, synced: false })
      await base.signOut()
    },

    changePassword: (p) => net(() => base.changePassword(p)),

    async getProfile() {
      const early = knownOffline() ? read()?.profile : null
      if (early) return early
      try {
        const p = await net(() => base.getProfile())
        mutate((s) => void (s.profile = p))
        return p
      } catch (e) {
        const cached = read()?.profile
        if (e instanceof NetworkError && cached) return cached
        throw e
      }
    },

    async getCycleHistory(userId) {
      const early = knownOffline() && !userId ? read()?.history : null
      if (early) return early
      try {
        const h = await net(() => base.getCycleHistory(userId))
        if (!userId) mutate((s) => void (s.history = h))
        return h
      } catch (e) {
        const cached = userId ? null : read()?.history
        if (e instanceof NetworkError && cached) return cached
        throw e
      }
    },

    setCycleStartDay: (day, userId) => net(() => base.setCycleStartDay(day, userId)),

    async ackCycleNotices() {
      await net(() => base.ackCycleNotices())
      mutate((s) => {
        if (s.history) s.history = { ...s.history, changes: s.history.changes.map((c) => ({ ...c, notice_pending: false })) }
      })
    },

    async listSessions(from, to) {
      const early = knownOffline() ? read() : null
      if (early) return overlay(cachedIn(early, from, to), from, to)
      try {
        const rows = await net(() => base.listSessions(from, to))
        mutate((s) => {
          for (const x of cachedIn(s, from, to)) delete s.sessions[x.id]
          for (const r of rows) s.sessions[r.id] = r
        })
        return overlay(rows, from, to)
      } catch (e) {
        const s = read()
        if (!(e instanceof NetworkError) || !s) throw e
        return overlay(cachedIn(s, from, to), from, to)
      }
    },

    async getRunning() {
      let rows: WorkSession[]
      const early = knownOffline() ? read() : null
      if (early) return overlay(Object.values(early.sessions).filter((x) => x.end_at === null), null, null).find((x) => x.end_at === null) ?? null
      try {
        const r = await net(() => base.getRunning())
        rows = r ? [r] : []
        if (r) remember(r)
      } catch (e) {
        const s = read()
        if (!(e instanceof NetworkError) || !s) throw e
        rows = Object.values(s.sessions).filter((x) => x.end_at === null)
      }
      return overlay(rows, null, null).find((x) => x.end_at === null) ?? null
    },

    async startSession(description) {
      const row: SessionRow = { id: crypto.randomUUID(), start_at: new Date().toISOString(), end_at: null, description }
      if (!getSyncStatus().offline || !uid) {
        try {
          const r = await net(() => base.putSession(row))
          remember(r)
          return r
        } catch (e) {
          if (!(e instanceof NetworkError) || !uid) throw e
        }
      }
      const made = mutate((s) => {
        if (overlay(Object.values(s.sessions), null, null).some((x) => x.end_at === null)) return null
        const m: WorkSession = { ...row, user_id: uid ?? '' }
        s.created[m.id] = m
        return m
      })
      if (!made) throw new ApiError(ONE_RUNNING)
      void sync()
      return { ...made, pending: true }
    },

    stopSession: (id) => change(id, { end_at: new Date().toISOString() }),

    async updateSession(id, patch) {
      const onlyDescription = Object.keys(patch).every((k) => k === 'description')
      if (uid && (read()?.created[id] || onlyDescription)) return change(id, patch as Patch)
      try {
        const r = await net(() => base.updateSession(id, patch))
        remember(r)
        return r
      } catch (e) {
        if (e instanceof NetworkError) throw new NetworkError(NEEDS_CONNECTION)
        throw e
      }
    },

    async createSession(input) {
      const r = await net(() => base.createSession(input))
      remember(r)
      return r
    },

    async deleteSession(id) {
      await net(() => base.deleteSession(id))
      mutate((s) => void delete s.sessions[id])
    },

    async listNotes(fromDay, toDay) {
      const inRange = (d: string) => d >= fromDay && d < toDay
      const early = knownOffline() ? read() : null
      if (early) {
        return Object.entries(early.notes)
          .filter(([d]) => inRange(d))
          .map(([day, note]) => ({ day, note }))
      }
      try {
        const rows = await net(() => base.listNotes(fromDay, toDay))
        mutate((s) => {
          for (const d of Object.keys(s.notes)) if (inRange(d)) delete s.notes[d]
          for (const r of rows) s.notes[r.day] = r.note
        })
        return rows
      } catch (e) {
        const s = read()
        if (!(e instanceof NetworkError) || !s) throw e
        return Object.entries(s.notes)
          .filter(([d]) => inRange(d))
          .map(([day, note]) => ({ day, note }))
      }
    },

    async saveNote(day, note) {
      await net(() => base.saveNote(day, note))
      mutate((s) => {
        if (note.trim() === '') delete s.notes[day]
        else s.notes[day] = note
      })
    },

    adminListUsers: () => net(() => base.adminListUsers()),
    adminCreateUser: (input) => net(() => base.adminCreateUser(input)),
    adminResetPassword: (userId, password) => net(() => base.adminResetPassword(userId, password)),
    adminUpdateUser: (userId, patch) => net(() => base.adminUpdateUser(userId, patch)),
  }
}
