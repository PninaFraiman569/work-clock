import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type CycleHistory, type Profile } from '../api'
import { useLoad, useNow, useOnFocus } from '../hooks/hooks'
import { scheduleFromHistory } from '../lib/cycleChange'
import { addDays, cycleFor, dayKey, startOfDay } from '../lib/time'
import { Header } from './Header'
import { ClockHero } from './ClockHero'
import { Records } from './Records'
import { MonthNotice } from './MonthNotice'
import { OfflineBanner } from './OfflineBanner'
import { InstallBanner } from './InstallBanner'
import { onDataChanged } from '../lib/syncStatus'

export function MainScreen({
  profile,
  history,
  onAccountChanged,
}: {
  profile: Profile
  history: CycleHistory
  onAccountChanged: () => void
}) {
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])
  useOnFocus(bump)
  // אחרי שליחה של רישומים מהמחשב, או כשהחיבור חוזר
  useEffect(() => onDataChanged(bump), [bump])

  // מתעדכן פעם בדקה; מספיק כדי לזהות מעבר יום
  const minuteNow = useNow(60_000)
  const todayKey = dayKey(minuteNow)
  const schedule = useMemo(() => scheduleFromHistory(profile.cycle_start_day, history), [profile.cycle_start_day, history])

  const range = useMemo(() => {
    const today = startOfDay(minuteNow)
    const cycle = cycleFor(today, schedule)
    const yesterday = addDays(today, -1)
    const from = yesterday < cycle.start ? yesterday : cycle.start
    const tomorrow = addDays(today, 1)
    const to = tomorrow > cycle.end ? tomorrow : cycle.end
    return { from, to, cycle }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, schedule])

  const recent = useLoad(() => api.listSessions(range.from, range.to), [range, version])
  const sessions = recent.data ?? []
  const running = sessions.find((s) => !s.end_at) ?? null

  return (
    <div className="min-h-screen">
      <Header profile={profile} onAccountChanged={onAccountChanged} />
      <OfflineBanner />
      <InstallBanner />
      <MonthNotice profileDay={profile.cycle_start_day} history={history} />
      <main className="mx-auto max-w-[1200px] px-8 pb-24">
        <ClockHero
          sessions={sessions}
          running={running}
          cycle={range.cycle}
          loaded={recent.data !== null}
          onChanged={bump}
        />
        <Records schedule={schedule} userName={profile.display_name || profile.username} version={version} onChanged={bump} />
      </main>
    </div>
  )
}
