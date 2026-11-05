import { DAY_MS, formatDuration, formatTime, startOfDay, type Piece } from '../lib/time'

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

/** פס של 24 שעות היום: כל מקטע עבודה מופיע במקומו לאורך היום */
export function DayRibbon({ pieces, now }: { pieces: Piece[]; now: Date }) {
  const dayStart = startOfDay(now).getTime()
  const pct = (d: Date) => ((d.getTime() - dayStart) / DAY_MS) * 100
  const nowPct = pct(now)

  return (
    <div className="border-t border-line px-10 pt-5 pb-4">
      <div className="mb-2.5 flex items-center justify-between text-sm text-ink-soft">
        <span>היום שלך</span>
        {pieces.length > 0 && (
          <span>
            {pieces.length} {pieces.length === 1 ? 'מקטע' : 'מקטעים'}
          </span>
        )}
      </div>

      <div className="relative h-9 rounded-[10px] bg-sunk">
        {/* קווי שעות */}
        {HOURS.slice(1, -1).map((h) => (
          <span key={h} className="absolute top-0 bottom-0 w-px bg-line" style={{ insetInlineStart: `${(h / 24) * 100}%` }} />
        ))}

        {pieces.map((p) => {
          const startPct = pct(p.start)
          const width = Math.max(pct(p.end) - startPct, 0.35)
          return (
            <div
              key={p.session.id + p.day}
              className={`absolute top-1 bottom-1 rounded-[6px] ${p.running ? 'ribbon-live' : 'bg-brand'}`}
              style={{ insetInlineStart: `${startPct}%`, width: `${width}%` }}
              title={`${formatTime(p.start)}–${p.running ? 'עכשיו' : p.continuesToNext ? '24:00' : formatTime(p.end)} (${formatDuration(p.ms)})${
                p.session.description ? `\n${p.session.description}` : ''
              }`}
            />
          )
        })}

        {/* עכשיו */}
        <span className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-ink" style={{ insetInlineStart: `${nowPct}%` }} aria-hidden="true" />
      </div>

      <div className="relative mt-1.5 h-4">
        {HOURS.map((h) => (
          <span
            key={h}
            className="num absolute text-xs text-ink-faint"
            style={{
              insetInlineStart: `${(h / 24) * 100}%`,
              transform: h === 0 ? 'none' : h === 24 ? 'translateX(100%)' : 'translateX(50%)',
            }}
          >
            {String(h).padStart(2, '0')}:00
          </span>
        ))}
      </div>
    </div>
  )
}
