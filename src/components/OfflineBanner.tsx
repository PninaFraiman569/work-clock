import { CircleAlert, CircleCheck, CloudUpload, WifiOff } from 'lucide-react'
import { useSyncStatus } from '../lib/syncStatus'

/** פס מצב החיבור: מופיע רק כשאין חיבור, בזמן שליחה, או כשיש בעיה */
export function OfflineBanner() {
  const { offline, pending, syncing, problem, synced } = useSyncStatus()

  let tone: string
  let icon: React.ReactNode
  let text: React.ReactNode
  if (offline) {
    tone = 'bg-note-tint text-note'
    icon = <WifiOff size={18} />
    text = (
      <>
        <span className="font-medium">אין חיבור לאינטרנט. השעון עובד כרגיל, והרישומים יישלחו כשיהיה חיבור.</span>{' '}
        בינתיים אפשר להתחיל ולסיים את השעון. הוספה ועריכה של רישומים יחזרו כשיהיה חיבור.
      </>
    )
  } else if (problem && pending > 0) {
    tone = 'bg-stop-tint text-stop'
    icon = <CircleAlert size={18} />
    text = <>רישום מהמחשב הזה עוד לא נשלח: {problem}</>
  } else if (syncing || pending > 0) {
    tone = 'bg-brand-tint text-brand'
    icon = <CloudUpload size={18} />
    text = 'שולח את הרישומים שנשמרו במחשב...'
  } else if (synced) {
    tone = 'bg-live-tint text-live'
    icon = <CircleCheck size={18} />
    text = 'כל הרישומים נשמרו'
  } else {
    return null
  }

  return (
    <div className="mx-auto max-w-[1200px] px-8 pb-4" role="status" aria-live="polite">
      <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-[15px] ${tone}`}>
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span>{text}</span>
      </div>
    </div>
  )
}
