import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError, NetworkError, type Api, type CycleHistory, type DayNote, type NewUserInput, type Profile, type WorkSession } from './types'
import type { OfflineBackend, SessionRow } from './offline'
import { usernameToEmail } from '../lib/username'

const SESSION_COLS = 'id,user_id,start_at,end_at,description'
/** בקשה שלא נענתה בזמן הזה נחשבת כאילו אין חיבור */
const REQUEST_TIMEOUT_MS = 20_000

const isNetworkMessage = (m: string) =>
  /Failed to fetch|NetworkError|Load failed|network|AbortError|aborted|timed? ?out|Failed to send a request/i.test(m)

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    // שגיאת רשת מגיעה בלי קוד מהשרת
    if (!res.error.code && isNetworkMessage(res.error.message)) throw new NetworkError()
    throw new ApiError(translateError(res.error.message, res.error.code), res.error.code, res.error.message)
  }
  return res.data
}

/** fetch עם הגבלת זמן, כדי שחיבור חלש לא ישאיר את האתר תקוע */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  init?.signal?.addEventListener('abort', () => ctrl.abort())
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

function translateError(message: string, code?: string): string {
  if (code === '23505' || /one_running/.test(message)) return 'כבר יש שעון פעיל. צריך לסיים אותו לפני שמתחילים חדש.'
  if (/valid_range|check constraint/i.test(message)) return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.'
  if (/Invalid login credentials/i.test(message)) return 'שם המשתמש או הסיסמה שגויים.'
  if (/banned/i.test(message)) return 'המשתמש הזה הושבת. אפשר לפנות למנהל.'
  if (/Password should be/i.test(message)) return 'הסיסמה קצרה מדי. צריך לפחות 6 תווים.'
  if (/same_password|different from the old/i.test(message)) return 'הסיסמה החדשה זהה לישנה.'
  if (code === 'PGRST202') return 'הגדרת החודש עוד לא הופעלה. צריך להריץ ב-Supabase את הקובץ supabase/cycle-changes.sql.'
  if (/Failed to fetch|NetworkError/i.test(message)) return 'אין חיבור לשרת. כדאי לבדוק את החיבור לאינטרנט.'
  return message
}

export function createSupabaseApi(url: string, key: string): OfflineBackend {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: { fetch: fetchWithTimeout },
  })
  // אותו שם ש-Supabase נותן כברירת מחדל, כדי לא לנתק משתמשים קיימים
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`

  async function uid(): Promise<string> {
    const { data, error } = await sb.auth.getSession()
    const id = data.session?.user.id
    if (id) return id
    // בלי חיבור Supabase לא מצליח לחדש את ההתחברות, אבל לא מוחק אותה
    if (error && isNetworkMessage(error.message)) throw new NetworkError()
    throw new ApiError('צריך להתחבר מחדש.')
  }

  async function admin<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await sb.functions.invoke('admin-users', { body: { action, ...payload } })
    if (error) {
      let msg = error.message
      try {
        const body = await (error as { context?: Response }).context?.json()
        if (body?.error) msg = body.error
      } catch {
        /* אין גוף תשובה */
      }
      if (isNetworkMessage(msg)) throw new NetworkError()
      throw new ApiError(translateError(msg))
    }
    return data as T
  }

  const api: Api = {
    demo: false,

    async currentUserId() {
      const { data } = await sb.auth.getSession()
      return data.session?.user.id ?? null
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user.id ?? null))
      return () => data.subscription.unsubscribe()
    },

    async signIn(username, password) {
      const { error } = await sb.auth.signInWithPassword({ email: usernameToEmail(username), password })
      if (error) throw new ApiError(translateError(error.message))
    },

    async signOut() {
      // local: היציאה מהמחשב הזה לא תלויה בחיבור לאינטרנט
      await sb.auth.signOut({ scope: 'local' })
    },

    async changePassword(newPassword) {
      const { error } = await sb.auth.updateUser({ password: newPassword })
      if (error) throw new ApiError(translateError(error.message))
    },

    async getProfile() {
      const id = await uid()
      return check(await sb.from('profiles').select('*').eq('id', id).single()) as Profile
    },

    async getCycleHistory(userId) {
      const res = await sb.rpc('get_cycle_history', { target_user: userId ?? null })
      // ה-SQL של הגדרת החודש עוד לא הורץ: אין עדיין היסטוריה
      if (res.error?.code === 'PGRST202') return { since: null, changes: [] }
      return check(res) as CycleHistory
    },

    async setCycleStartDay(day, userId) {
      check(await sb.rpc('set_cycle_start_day', { new_day: day, target_user: userId ?? null }))
    },

    async ackCycleNotices() {
      check(await sb.rpc('ack_cycle_notices'))
    },

    async listSessions(from, to) {
      const rows = check(
        await sb
          .from('work_sessions')
          .select(SESSION_COLS)
          .lt('start_at', to.toISOString())
          .or(`end_at.is.null,end_at.gt.${from.toISOString()}`)
          .order('start_at'),
      )
      return (rows ?? []) as WorkSession[]
    },

    async getRunning() {
      const rows = check(await sb.from('work_sessions').select(SESSION_COLS).is('end_at', null).limit(1))
      return ((rows ?? [])[0] as WorkSession) ?? null
    },

    async startSession(description) {
      return check(
        await sb
          .from('work_sessions')
          .insert({ start_at: new Date().toISOString(), description })
          .select(SESSION_COLS)
          .single(),
      ) as WorkSession
    },

    async stopSession(id) {
      return check(
        await sb
          .from('work_sessions')
          .update({ end_at: new Date().toISOString() })
          .eq('id', id)
          .select(SESSION_COLS)
          .single(),
      ) as WorkSession
    },

    async createSession(input) {
      return check(await sb.from('work_sessions').insert(input).select(SESSION_COLS).single()) as WorkSession
    },

    async updateSession(id, patch) {
      return check(
        await sb.from('work_sessions').update(patch).eq('id', id).select(SESSION_COLS).single(),
      ) as WorkSession
    },

    async deleteSession(id) {
      check(await sb.from('work_sessions').delete().eq('id', id))
    },

    async listNotes(fromDay, toDay) {
      const rows = check(
        await sb.from('day_notes').select('day,note').gte('day', fromDay).lt('day', toDay),
      )
      return (rows ?? []) as DayNote[]
    },

    async saveNote(day, note) {
      if (note.trim() === '') {
        check(await sb.from('day_notes').delete().eq('day', day))
      } else {
        const user_id = await uid()
        check(await sb.from('day_notes').upsert({ user_id, day, note }, { onConflict: 'user_id,day' }))
      }
    },

    async adminListUsers() {
      const res = await admin<{ users: Profile[] }>('list')
      return res.users
    },

    async adminCreateUser(input: NewUserInput) {
      await admin('create', { ...input, email: usernameToEmail(input.username) })
    },

    async adminResetPassword(userId, password) {
      await admin('reset_password', { user_id: userId, password })
    },

    async adminUpdateUser(userId, patch) {
      await admin('update', { user_id: userId, ...patch })
    },
  }

  return {
    ...api,

    async putSession(row: SessionRow) {
      return check(await sb.from('work_sessions').insert(row).select(SESSION_COLS).single()) as WorkSession
    },

    storedUserId() {
      try {
        const raw = localStorage.getItem(storageKey)
        const saved = raw ? (JSON.parse(raw) as { refresh_token?: string; user?: { id?: string } }) : null
        return saved?.refresh_token && saved.user?.id ? saved.user.id : null
      } catch {
        return null
      }
    },
  }
}
