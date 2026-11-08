import { useEffect, useState } from 'react'

/** מנרמל קלט שעה חופשי לפורמט HH:MM. "8" -> 08:00, "812" -> 08:12, "17.5" -> 17:05 */
export function normalizeTime(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  let h: number
  let m: number
  const parts = t.split(/[:.\s]/).filter(Boolean)
  if (parts.length >= 2) {
    h = Number(parts[0])
    m = Number(parts[1])
  } else {
    const d = t.replace(/\D/g, '')
    if (d.length === 0 || d.length > 4) return null
    if (d.length <= 2) {
      h = Number(d)
      m = 0
    } else {
      h = Number(d.slice(0, d.length - 2))
      m = Number(d.slice(-2))
    }
  }
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** שדה שעה בפורמט 24 שעות, לא תלוי בהגדרות המחשב */
export function TimeField({
  value,
  onChange,
  className = 'cell-input time-input',
  ...rest
}: {
  value: string
  onChange: (v: string) => void
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      {...rest}
      dir="ltr"
      inputMode="numeric"
      maxLength={5}
      placeholder={rest.placeholder ?? '--:--'}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d:.]/g, ''))}
      onBlur={(e) => {
        const n = normalizeTime(value)
        if (n) onChange(n)
        rest.onBlur?.(e)
      }}
    />
  )
}

/** שדה שעה בטבלה: נשמר כשיוצאים ממנו (או ב-Enter) */
export function TimeInput({
  value,
  onCommit,
  label,
  disabled,
  title,
}: {
  value: string
  onCommit: (v: string) => void
  label: string
  disabled?: boolean
  title?: string
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])

  const commit = () => {
    const n = normalizeTime(v)
    if (!n) return setV(value)
    setV(n)
    if (n !== value) onCommit(n)
  }

  return (
    <input
      dir="ltr"
      inputMode="numeric"
      maxLength={5}
      className="cell-input time-input"
      value={v}
      aria-label={label}
      disabled={disabled}
      title={title}
      onChange={(e) => setV(e.target.value.replace(/[^\d:.]/g, ''))}
      onBlur={commit}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setV(value)
      }}
    />
  )
}

/** שדה טקסט שנשמר כשיוצאים ממנו (או ב-Enter) */
export function TextCell({
  value,
  onCommit,
  placeholder,
  label,
  className = '',
  disabled,
  title,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  label: string
  className?: string
  disabled?: boolean
  title?: string
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      className={`cell-input ${className}`}
      value={v}
      disabled={disabled}
      title={title}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setV(value)
      }}
    />
  )
}
