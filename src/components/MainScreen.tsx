import { useCallback, useMemo, useState } from 'react'
import { api, type Profile } from '../api'
import { useLoad, useNow, useOnFocus } from '../hooks/hooks'
import { addDays, cycleFor, dayKey, startOfDay } from '../lib/time'
import { Header } from './Header'
import { ClockHero } from './ClockHero'
import { Records } from './Records'

export function MainScreen({ profile, onProfileChange }: { profile: Profile; onProfileChange: (p: Profile) => void }) {
  const [version, setVersion] = useState(0)
  const bump = useCallback(() => setVersion((v) => v + 1), [])
  useOnFocus(bump)

  // מתעדכן פעם בדקה; מספיק כדי לזהות מעבר יום
  const minuteNow = useNow(60_000)
  const todayKey = dayKey(minuteNow)
  const startDay = profile.cycle_start_day

  const range = useMemo(() => {
    const today = startOfDay(minuteNow)
    const cycle = cycleFor(today, startDay)
    const yesterday = addDays(today, -1)
    const from = yesterday < cycle.start ? yesterday : cycle.start
    const tomorrow = addDays(today, 1)
    const to = tomorrow > cycle.end ? tomorrow : cycle.end
    return { from, to, cycle }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, startDay])

  const recent = useLoad(() => api.listSessions(range.from, range.to), [range, version])
  const sessions = recent.data ?? []
  const running = sessions.find((s) => !s.end_at) ?? null

  return (
    <div className="min-h-screen">
      <Header profile={profile} onProfileChange={onProfileChange} />
      <main className="mx-auto max-w-[1200px] px-8 pb-24">
        <ClockHero
          sessions={sessions}
          running={running}
          cycle={range.cycle}
          loaded={recent.data !== null}
          onChanged={bump}
        />
        <Records startDay={startDay} userName={profile.display_name || profile.username} version={version} onChanged={bump} />
      </main>
    </div>
  )
}
