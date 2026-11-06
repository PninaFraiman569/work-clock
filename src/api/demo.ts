// מצב הדגמה: עובד בלי שרת, שומר הכל בדפדפן בלבד.
// נפתח אוטומטית כשלא הוגדרו משתני Supabase. שימושי לניסיון ולפיתוח.

import { ApiError, type Api, type CycleChange, type DayNote, type Profile, type WorkSession } from './types'
import { DEFAULT_CYCLE_START_DAY } from '../config'
import { cycleIndex, scheduleFromHistory } from '../lib/cycleChange'
import { cycleFor, dayKey, startDayAt } from '../lib/time'
import { normalizeUsername } from '../lib/username'

const KEY = 'work-clock-demo-v1'

interface DemoUser extends Profile {
  password: string
}

interface DemoState {
  currentUser: string | null
  users: DemoUser[]
  sessions: WorkSession[]
  notes: (DayNote & { user_id: string })[]
  cycleChanges?: (CycleChange & { user_id: string })[]
}

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

function seed(): DemoState {
  const admin: DemoUser = {
    id: 'demo-admin',
    username: 'demo',
    display_name: 'משתמש לדוגמה',
    is_admin: true,
    cycle_start_day: DEFAULT_CYCLE_START_DAY,
    disabled: false,
    password: 'demo',
  }
  const tasks = ['הכנת הצעת מחיר', 'שיחות עם ספקים', 'עדכון מלאי', 'פגישה עם לקוח', 'סידור חשבוניות', 'מענה למיילים', 'הכנת דוח חודשי', '']
  const sessions: WorkSession[] = []
  const today = new Date()
  for (let back = 45; back >= 1; back--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back)
    if (d.getDay() === 6) continue // שבת
    if (d.getDay() === 5 && back % 2) continue
    const at = (h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString()
    const j = (back * 7) % 13
    const t = (k: number) => tasks[(back + k) % tasks.length]
    sessions.push({ id: rid(), user_id: admin.id, start_at: at(8, 5 + j), end_at: at(12, 40 + (j % 15)), description: t(0) })
    sessions.push({ id: rid(), user_id: admin.id, start_at: at(13, 20 + j), end_at: at(16 + (back % 2), 10 + j), description: t(3) })
    if (back % 6 === 0) {
      // ערב שנמשך אחרי חצות
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 50)
      sessions.push({ id: rid(), user_id: admin.id, start_at: at(21, 30), end_at: next.toISOString(), description: 'סגירת חודש' })
    }
  }
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 12)
  const t1 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 47)
  if (t1 < today) sessions.push({ id: rid(), user_id: admin.id, start_at: t0.toISOString(), end_at: t1.toISOString(), description: 'מענה למיילים' })
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const key = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  return {
    currentUser: null,
    users: [admin],
    sessions,
    notes: [{ user_id: admin.id, day: key, note: 'יצאתי מוקדם לאסוף את הילדים' }],
  }
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DemoState
  } catch {
    /* אחסון לא זמין */
  }
  return seed()
}

export function createDemoApi(): Api {
  let state = load()
  const listeners = new Set<(id: string | null) => void>()
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* אחסון לא זמין */
    }
  }
  const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60))
  const me = () => {
    const u = state.users.find((x) => x.id === state.currentUser)
    if (!u) throw new ApiError('צריך להתחבר מחדש.')
    return u
  }
  const mine = () => state.sessions.filter((s) => s.user_id === me().id)
  const strip = ({ password: _p, ...rest }: DemoUser): Profile => rest
  const validate = (s: WorkSession) => {
    if (s.end_at && new Date(s.end_at) <= new Date(s.start_at)) throw new ApiError('שעת הסיום חייבת להיות אחרי שעת ההתחלה.')
  }

  return {
    demo: true,

    async currentUserId() {
      return delay(state.currentUser)
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signIn(username, password) {
      const u = state.users.find((x) => x.username === normalizeUsername(username))
      if (!u || u.password !== password) throw new ApiError('שם המשתמש או הסיסמה שגויים.')
      if (u.disabled) throw new ApiError('המשתמש הזה הושבת. אפשר לפנות למנהל.')
      state.currentUser = u.id
      save()
      listeners.forEach((l) => l(u.id))
    },
    async signOut() {
      state.currentUser = null
      save()
      listeners.forEach((l) => l(null))
    },
    async changePassword(newPassword) {
      if (newPassword.length < 6) throw new ApiError('הסיסמה קצרה מדי. צריך לפחות 6 תווים.')
      me().password = newPassword
      save()
    },
    async getProfile() {
      return delay(strip(me()))
    },

    async getCycleHistory(userId) {
      const id = userId ?? me().id
      if (id !== me().id && !me().is_admin) throw new ApiError('הפעולה הזאת מותרת רק למנהל.')
      const first = state.sessions
        .filter((s) => s.user_id === id)
        .map((s) => s.start_at)
        .sort()[0]
      return delay({
        since: dayKey(first ? new Date(first) : new Date()),
        changes: (state.cycleChanges ?? []).filter((c) => c.user_id === id).map(({ user_id: _u, ...c }) => ({ ...c })),
      })
    },
    async setCycleStartDay(day, userId) {
      const id = userId ?? me().id
      if (id !== me().id && !me().is_admin) throw new ApiError('הפעולה הזאת מותרת רק למנהל.')
      const user = state.users.find((u) => u.id === id)
      if (!user) throw new ApiError('המשתמש לא נמצא.')
      const all = state.cycleChanges ?? []
      const own = all.filter((c) => c.user_id === id)
      const schedule = scheduleFromHistory(user.cycle_start_day, { since: null, changes: own })
      const current = cycleIndex(cycleFor(new Date(), schedule))
      const effective = current + 1
      const effectiveKey = `${Math.floor(effective / 12)}-${String((effective % 12) + 1).padStart(2, '0')}-01`
      const inForce = startDayAt(schedule, current)
      const kept = all.filter((c) => c.user_id !== id || c.effective_month < effectiveKey)
      if (day !== inForce) {
        kept.push({
          user_id: id,
          effective_month: effectiveKey,
          old_start_day: inForce,
          new_start_day: day,
          changed_at: new Date().toISOString(),
          notice_pending: id !== me().id,
        })
      }
      state.cycleChanges = kept
      user.cycle_start_day = day
      save()
    },
    async ackCycleNotices() {
      const id = me().id
      for (const c of state.cycleChanges ?? []) if (c.user_id === id) c.notice_pending = false
      save()
    },

    async listSessions(from, to) {
      const f = from.getTime()
      const t = to.getTime()
      return delay(
        mine()
          .filter((s) => new Date(s.start_at).getTime() < t && (!s.end_at || new Date(s.end_at).getTime() > f))
          .sort((a, b) => a.start_at.localeCompare(b.start_at))
          .map((s) => ({ ...s })),
      )
    },
    async getRunning() {
      const s = mine().find((x) => !x.end_at)
      return delay(s ? { ...s } : null)
    },
    async startSession(description) {
      if (mine().some((x) => !x.end_at)) throw new ApiError('כבר יש שעון פעיל. צריך לסיים אותו לפני שמתחילים חדש.')
      const s: WorkSession = { id: rid(), user_id: me().id, start_at: new Date().toISOString(), end_at: null, description }
      state.sessions.push(s)
      save()
      return delay({ ...s })
    },
    async stopSession(id) {
      const s = mine().find((x) => x.id === id)
      if (!s) throw new ApiError('הרישום לא נמצא.')
      s.end_at = new Date().toISOString()
      save()
      return delay({ ...s })
    },
    async createSession(input) {
      const s: WorkSession = { id: rid(), user_id: me().id, ...input }
      validate(s)
      state.sessions.push(s)
      save()
      return delay({ ...s })
    },
    async updateSession(id, patch) {
      const s = mine().find((x) => x.id === id)
      if (!s) throw new ApiError('הרישום לא נמצא.')
      const next = { ...s, ...patch }
      validate(next)
      Object.assign(s, patch)
      save()
      return delay({ ...s })
    },
    async deleteSession(id) {
      state.sessions = state.sessions.filter((x) => x.id !== id)
      save()
    },

    async listNotes(fromDay, toDay) {
      const id = me().id
      return delay(state.notes.filter((n) => n.user_id === id && n.day >= fromDay && n.day < toDay).map(({ day, note }) => ({ day, note })))
    },
    async saveNote(day, note) {
      const id = me().id
      state.notes = state.notes.filter((n) => !(n.user_id === id && n.day === day))
      if (note.trim()) state.notes.push({ user_id: id, day, note })
      save()
    },

    async adminListUsers() {
      if (!me().is_admin) throw new ApiError('אין הרשאה.')
      return delay(state.users.map(strip))
    },
    async adminCreateUser(input) {
      const username = normalizeUsername(input.username)
      if (state.users.some((u) => u.username === username)) throw new ApiError('שם המשתמש הזה כבר תפוס.')
      state.users.push({
        id: rid(),
        username,
        display_name: input.display_name,
        password: input.password,
        cycle_start_day: input.cycle_start_day,
        is_admin: false,
        disabled: false,
      })
      save()
    },
    async adminResetPassword(userId, password) {
      const u = state.users.find((x) => x.id === userId)
      if (u) u.password = password
      save()
    },
    async adminUpdateUser(userId, patch) {
      const u = state.users.find((x) => x.id === userId)
      if (u) Object.assign(u, patch)
      save()
    },
  }
}
