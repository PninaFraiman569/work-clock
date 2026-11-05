// הגדרות כלליות של האתר. כאן משנים את שם האתר.

export const APP_NAME = 'שעון עבודה'

// יום ברירת המחדל שבו מתחיל מחזור חודשי (27 = המחזור הוא מ-27 עד 26 בחודש הבא)
export const DEFAULT_CYCLE_START_DAY = 27

// Supabase דורש כתובת מייל לכל משתמש. מאחר שהכניסה היא בשם משתמש בלבד,
// כל שם משתמש מתורגם לכתובת פנימית בדומיין הזה. אף מייל לא נשלח לשם.
// חשוב: אם משנים את הערך הזה, צריך לשנות אותו גם בקובץ supabase/functions/admin-users/index.ts
export const AUTH_EMAIL_DOMAIN = 'workclock.local'
