// פונקציית ניהול משתמשים (רצה בשרת של Supabase).
// רק משתמש שמסומן כמנהל יכול להשתמש בה.
// פעולות: list, create, reset_password, update

import { createClient } from 'npm:@supabase/supabase-js@2'

// חייב להיות זהה ל-AUTH_EMAIL_DOMAIN בקובץ src/config.ts
const AUTH_EMAIL_DOMAIN = 'workclock.local'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const fail = (message: string, status = 400) => json({ error: message }, status)

function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase()
  if (/^[a-z0-9._-]+$/.test(u)) return `${u}@${AUTH_EMAIL_DOMAIN}`
  const hex = Array.from(new TextEncoder().encode(u), (b) => b.toString(16).padStart(2, '0')).join('')
  return `u-${hex}@${AUTH_EMAIL_DOMAIN}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('Method not allowed', 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // זיהוי המשתמש שפונה ובדיקה שהוא מנהל
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return fail('צריך להתחבר מחדש.', 401)
  const { data: who, error: whoErr } = await admin.auth.getUser(token)
  if (whoErr || !who.user) return fail('צריך להתחבר מחדש.', 401)
  const { data: me } = await admin.from('profiles').select('is_admin, disabled').eq('id', who.user.id).single()
  if (!me?.is_admin || me.disabled) return fail('הפעולה הזאת מותרת רק למנהל.', 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('בקשה לא תקינה.')
  }

  try {
    switch (body.action) {
      case 'list': {
        const { data, error } = await admin
          .from('profiles')
          .select('id, username, display_name, is_admin, cycle_start_day, disabled')
          .order('created_at')
        if (error) throw error
        return json({ users: data })
      }

      case 'create': {
        const username = String(body.username ?? '').trim().toLowerCase()
        const password = String(body.password ?? '')
        const display_name = String(body.display_name ?? '').trim()
        const cycle_start_day = Number(body.cycle_start_day ?? 27)
        if (!username || /\s/.test(username)) return fail('שם המשתמש לא תקין (בלי רווחים).')
        if (username.startsWith('u-')) return fail('שם משתמש לא יכול להתחיל ב-"u-".')
        if (password.length < 6) return fail('הסיסמה צריכה להכיל לפחות 6 תווים.')
        if (!(cycle_start_day >= 1 && cycle_start_day <= 28)) return fail('יום תחילת המחזור לא תקין.')

        const { data: exists } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
        if (exists) return fail('שם המשתמש הזה כבר תפוס.')

        const { error } = await admin.auth.admin.createUser({
          email: usernameToEmail(username),
          password,
          email_confirm: true,
          user_metadata: { username, display_name, cycle_start_day },
        })
        if (error) throw error
        return json({ ok: true })
      }

      case 'reset_password': {
        const password = String(body.password ?? '')
        if (password.length < 6) return fail('הסיסמה צריכה להכיל לפחות 6 תווים.')
        const { error } = await admin.auth.admin.updateUserById(String(body.user_id), { password })
        if (error) throw error
        return json({ ok: true })
      }

      case 'update': {
        const userId = String(body.user_id)
        const patch: Record<string, unknown> = {}
        if (typeof body.display_name === 'string') patch.display_name = body.display_name.trim()
        if (body.cycle_start_day !== undefined) {
          const d = Number(body.cycle_start_day)
          if (!(d >= 1 && d <= 28)) return fail('יום תחילת המחזור לא תקין.')
          patch.cycle_start_day = d
        }
        if (typeof body.disabled === 'boolean') {
          if (userId === who.user.id) return fail('אי אפשר להשבית את עצמך.')
          patch.disabled = body.disabled
          // חסימת כניסה ברמת מערכת ההתחברות
          const { error } = await admin.auth.admin.updateUserById(userId, {
            ban_duration: body.disabled ? '876000h' : 'none',
          })
          if (error) throw error
        }
        if (Object.keys(patch).length) {
          const { error } = await admin.from('profiles').update(patch).eq('id', userId)
          if (error) throw error
        }
        return json({ ok: true })
      }

      default:
        return fail('פעולה לא מוכרת.')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/already been registered|already exists/i.test(msg)) return fail('שם המשתמש הזה כבר תפוס.')
    return fail(msg, 500)
  }
})
