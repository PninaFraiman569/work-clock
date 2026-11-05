import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ApiError, type Api, type DayNote, type NewUserInput, type Profile, type WorkSession } from './types'
import { usernameToEmail } from '../lib/username'

const SESSION_COLS = 'id,user_id,start_at,end_at,description'

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new ApiError(translateError(res.error.message, res.error.code))
  return res.data
}

function translateError(message: string, code?: string): string {
  if (code === '23505' || /one_running/.test(message)) return 'כבר יש שעון פעיל. צריך לסיים אותו לפני שמתחילים חדש.'
  if (/valid_range|check constraint/i.test(message)) return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.'
  if (/Invalid login credentials/i.test(message)) return 'שם המשתמש או הסיסמה שגויים.'
  if (/banned/i.test(message)) return 'המשתמש הזה הושבת. אפשר לפנות למנהל.'
  if (/Password should be/i.test(message)) return 'הסיסמה קצרה מדי. צריך לפחות 6 תווים.'
  if (/same_password|different from the old/i.test(message)) return 'הסיסמה החדשה זהה לישנה.'
  if (/Failed to fetch|NetworkError/i.test(message)) return 'אין חיבור לשרת. כדאי לבדוק את החיבור לאינטרנט.'
  return message
}

export function createSupabaseApi(url: string, key: string): Api {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  })

  async function uid(): Promise<string> {
    const { data } = await sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new ApiError('צריך להתחבר מחדש.')
    return id
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
      throw new ApiError(translateError(msg))
    }
    return data as T
  }

  return {
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
      await sb.auth.signOut()
    },

    async changePassword(newPassword) {
      const { error } = await sb.auth.updateUser({ password: newPassword })
      if (error) throw new ApiError(translateError(error.message))
    },

    async getProfile() {
      const id = await uid()
      return check(await sb.from('profiles').select('*').eq('id', id).single()) as Profile
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
}
