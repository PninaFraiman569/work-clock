import { AUTH_EMAIL_DOMAIN } from '../config'

/**
 * ממיר שם משתמש לכתובת המייל הפנימית ב-Supabase.
 * שמות באנגלית נשמרים כמו שהם (moshe -> moshe@domain).
 * שמות בעברית או עם תווים אחרים מקודדים (u-<hex>@domain).
 * אותה פונקציה בדיוק קיימת בפונקציית הניהול בשרת.
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function usernameToEmail(username: string): string {
  const u = normalizeUsername(username)
  if (/^[a-z0-9._-]+$/.test(u)) return `${u}@${AUTH_EMAIL_DOMAIN}`
  const hex = Array.from(new TextEncoder().encode(u), (b) => b.toString(16).padStart(2, '0')).join('')
  return `u-${hex}@${AUTH_EMAIL_DOMAIN}`
}
