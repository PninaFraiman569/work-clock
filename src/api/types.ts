export interface WorkSession {
  id: string
  user_id: string
  start_at: string // ISO
  end_at: string | null // null = השעון רץ
  description: string
  /** נשמר רק במחשב הזה, ועוד לא נשלח לשרת */
  pending?: boolean
}

export interface DayNote {
  day: string // yyyy-MM-dd
  note: string
}

export interface Profile {
  id: string
  username: string
  display_name: string
  is_admin: boolean
  cycle_start_day: number
  disabled: boolean
}

export interface CycleChange {
  effective_month: string // yyyy-MM-01: החודש הראשון שמסתיים לפי ההגדרה החדשה
  old_start_day: number
  new_start_day: number
  changed_at: string // ISO
  notice_pending: boolean // מנהל שינה, והמשתמש עוד לא ראה הודעה
}

export interface CycleHistory {
  since: string | null // yyyy-MM-dd: מתי המשתמש נוצר
  changes: CycleChange[]
}

export interface NewUserInput {
  username: string
  display_name: string
  password: string
  cycle_start_day: number
}

export interface Api {
  readonly demo: boolean

  // התחברות
  currentUserId(): Promise<string | null>
  onAuthChange(cb: (userId: string | null) => void): () => void
  signIn(username: string, password: string): Promise<void>
  signOut(): Promise<void>
  changePassword(newPassword: string): Promise<void>
  getProfile(): Promise<Profile>

  // הגדרת חודש (בלי userId: המשתמש המחובר. עם userId: מנהל בלבד)
  getCycleHistory(userId?: string): Promise<CycleHistory>
  setCycleStartDay(day: number, userId?: string): Promise<void>
  ackCycleNotices(): Promise<void>

  // רישומי עבודה
  listSessions(from: Date, to: Date): Promise<WorkSession[]>
  getRunning(): Promise<WorkSession | null>
  startSession(description: string): Promise<WorkSession>
  stopSession(id: string): Promise<WorkSession>
  createSession(input: { start_at: string; end_at: string; description: string }): Promise<WorkSession>
  updateSession(id: string, patch: Partial<Pick<WorkSession, 'start_at' | 'end_at' | 'description'>>): Promise<WorkSession>
  deleteSession(id: string): Promise<void>

  // הערות יומיות
  listNotes(fromDay: string, toDay: string): Promise<DayNote[]>
  saveNote(day: string, note: string): Promise<void>

  // ניהול (מנהל בלבד)
  adminListUsers(): Promise<Profile[]>
  adminCreateUser(input: NewUserInput): Promise<void>
  adminResetPassword(userId: string, password: string): Promise<void>
  adminUpdateUser(userId: string, patch: { display_name?: string; disabled?: boolean }): Promise<void>
}

export class ApiError extends Error {
  /** קוד השגיאה מהשרת, ופירוט השגיאה המקורי (לפני התרגום) */
  readonly code?: string
  readonly raw?: string
  constructor(message: string, code?: string, raw?: string) {
    super(message)
    this.code = code
    this.raw = raw
  }
}

/** השרת לא זמין: אין אינטרנט, או שהבקשה לא הגיעה ליעדה */
export class NetworkError extends ApiError {
  constructor(message = 'אין חיבור לאינטרנט. הפעולה הזאת אפשרית רק כשיש חיבור.') {
    super(message)
  }
}
