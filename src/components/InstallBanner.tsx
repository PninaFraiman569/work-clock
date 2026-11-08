import { useState } from 'react'
import { MonitorDown, X } from 'lucide-react'
import { installApp, useCanInstall } from '../lib/install'

const DISMISSED = 'work-clock-install-dismissed'

/** הודעה חד-פעמית: אפשר להתקין את האתר במחשב. אחרי סגירה או התקנה היא לא חוזרת. */
export function InstallBanner() {
  const canInstall = useCanInstall()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED) === '1')
  if (!canInstall || dismissed) return null

  const close = () => {
    localStorage.setItem(DISMISSED, '1')
    setDismissed(true)
  }

  return (
    <div className="mx-auto max-w-[1200px] px-8 pb-4">
      <div className="flex items-center gap-3 rounded-xl bg-brand-tint px-4 py-3 text-[15px] text-brand">
        <MonitorDown size={18} className="shrink-0" />
        <span className="flex-1">אפשר להתקין את שעון עבודה במחשב, ולעבוד איתו גם בלי אינטרנט.</span>
        <button
          type="button"
          className="btn btn-primary h-8 px-3 text-sm"
          onClick={() => void installApp().then((ok) => ok && close())}
        >
          התקנה
        </button>
        <button type="button" className="icon-btn size-8 text-brand" onClick={close} aria-label="סגירת ההודעה" title="לא עכשיו">
          <X size={17} />
        </button>
      </div>
    </div>
  )
}
