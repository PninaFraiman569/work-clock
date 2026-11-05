import { useCallback, useEffect, useRef, useState } from 'react'

/** הזמן הנוכחי, מתעדכן כל intervalMs */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** טעינת נתונים: שומר את הנתונים הקודמים בזמן טעינה מחדש כדי שלא יהיה הבהוב */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)

  const reload = useCallback(async () => {
    const my = ++seq.current
    setLoading(true)
    try {
      const res = await run()
      if (my === seq.current) {
        setData(res)
        setError(null)
      }
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [run])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, loading, reload }
}

/** פעולה שמופעלת כשחוזרים ללשונית (למשל לרענון נתונים) */
export function useOnFocus(cb: () => void) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') ref.current()
    }
    document.addEventListener('visibilitychange', handler)
    window.addEventListener('focus', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      window.removeEventListener('focus', handler)
    }
  }, [])
}
