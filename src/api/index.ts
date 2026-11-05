import { createSupabaseApi } from './supabase'
import { createDemoApi } from './demo'
import type { Api } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** אם הוגדרו פרטי Supabase, עובדים מול השרת; אחרת נפתח מצב הדגמה */
export const api: Api = url && key ? createSupabaseApi(url, key) : createDemoApi()

export * from './types'
