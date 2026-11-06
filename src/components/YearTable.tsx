import { ChevronLeft } from 'lucide-react'
import type { WorkSession } from '../api'
import { useNow } from '../hooks/hooks'
import { cycleRangeText, formatDuration, groupByDay, HEB_MONTHS, piecesInRange, sumMs, yearCycles, type Cycle, type CycleSchedule } from '../lib/time'

export function YearTable({
  year,
  schedule,
  sessions,
  onOpenMonth,
}: {
  year: number
  schedule: CycleSchedule
  sessions: WorkSession[]
  onOpenMonth: (c: Cycle) => void
}) {
  const now = useNow(30_000)
  const rows = yearCycles(year, schedule).map((c) => {
    const pieces = piecesInRange(sessions, c, now)
    return { cycle: c, ms: sumMs(pieces), days: groupByDay(pieces).size, future: c.start > now }
  })
  const max = Math.max(...rows.map((r) => r.ms), 1)
  const total = rows.reduce((a, r) => a + r.ms, 0)
  const totalDays = rows.reduce((a, r) => a + r.days, 0)

  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
      <table className="w-full border-collapse text-[16px]">
        <colgroup>
          <col className="w-[200px]" />
          <col className="w-[170px]" />
          <col className="w-[120px]" />
          <col className="w-[110px]" />
          <col />
          <col className="w-[56px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line bg-sunk text-sm text-ink-soft">
            <th className="px-6 py-3 text-start font-medium">חודש</th>
            <th className="px-3 py-3 text-start font-medium">תאריכים</th>
            <th className="px-3 py-3 text-start font-medium">ימי עבודה</th>
            <th className="px-3 py-3 text-start font-medium">שעות</th>
            <th />
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.cycle.labelMonth}
              onClick={() => onOpenMonth(r.cycle)}
              className={`group cursor-pointer border-b border-line last:border-b-0 transition-colors hover:bg-sunk/70 ${r.future ? 'text-ink-faint' : ''}`}
            >
              <td className="px-6 py-3.5">
                <button className="font-display text-[17px] font-medium group-hover:text-brand" onClick={() => onOpenMonth(r.cycle)}>
                  {HEB_MONTHS[r.cycle.labelMonth]}
                </button>
                {r.cycle.transition && <span className="ms-2 rounded-md bg-note-tint px-1.5 py-0.5 text-xs font-medium text-note">מעבר</span>}
              </td>
              <td className="num px-3 py-3.5 text-[15px] text-ink-soft">{cycleRangeText(r.cycle)}</td>
              <td className="num px-3 py-3.5">{r.days || '–'}</td>
              <td className="num px-3 py-3.5 font-medium" dir="ltr" style={{ textAlign: 'right' }}>
                {r.ms ? formatDuration(r.ms) : '–'}
              </td>
              <td className="px-3 py-3.5">
                <div className="h-2.5 overflow-hidden rounded-full bg-sunk">
                  <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(r.ms / max) * 100}%` }} />
                </div>
              </td>
              <td className="px-3 text-ink-faint group-hover:text-brand">
                <ChevronLeft size={18} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-ink text-white">
            <td className="px-6 py-4 font-display text-lg font-medium">סה״כ בשנה</td>
            <td />
            <td className="num px-3 py-4">{totalDays}</td>
            <td className="num px-3 py-4 text-xl font-semibold" dir="ltr" style={{ textAlign: 'right' }}>
              {formatDuration(total)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
