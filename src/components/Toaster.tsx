import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'

type Kind = 'ok' | 'error'
interface Toast {
  id: number
  kind: Kind
  text: string
}

const subs = new Set<(t: Toast) => void>()
let next = 1

export function toast(text: string, kind: Kind = 'ok') {
  const t = { id: next++, kind, text }
  subs.forEach((s) => s(t))
}

export function toastError(e: unknown) {
  toast(e instanceof Error ? e.message : String(e), 'error')
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    const sub = (t: Toast) => {
      setItems((prev) => [...prev, t])
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.kind === 'error' ? 6000 : 2800)
    }
    subs.add(sub)
    return () => {
      subs.delete(sub)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 text-[15px] shadow-lg ${
            t.kind === 'error' ? 'bg-stop text-white' : 'bg-ink text-white'
          }`}
        >
          {t.kind === 'error' ? <CircleAlert size={18} /> : <CircleCheck size={18} className="text-live-soft" />}
          {t.text}
        </div>
      ))}
    </div>
  )
}
