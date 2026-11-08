// התקנת האתר במחשב כאפליקציה, מתוך כפתור באתר.
// הדפדפן (Edge או Chrome) מודיע כשאפשר להתקין, ואנחנו שומרים את ההודעה
// כדי לפתוח את חלון ההתקנה שלו כשלוחצים על הכפתור.
// בדפדפנים בלי האפשרות הזאת, ואחרי שהאתר כבר מותקן, הכפתור לא מופיע.

import { useSyncExternalStore } from 'react'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // במקום ההצעה של הדפדפן, הכפתור שלנו
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

const canInstallNow = () => deferred !== null

/** אפשר להתקין עכשיו (והאתר עוד לא מותקן) */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
    canInstallNow,
  )
}

/** פותח את חלון ההתקנה של הדפדפן. מחזיר true אם המשתמש אישר. */
export async function installApp(): Promise<boolean> {
  const e = deferred
  if (!e) return false
  await e.prompt()
  const { outcome } = await e.userChoice
  // הדפדפן מאפשר לפתוח את החלון פעם אחת לכל הודעה
  deferred = null
  notify()
  return outcome === 'accepted'
}
