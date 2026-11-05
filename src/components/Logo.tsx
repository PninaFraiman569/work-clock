export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--color-ink)" />
      <circle cx="32" cy="34" r="17" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M32 34V24" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <rect x="26" y="8" width="12" height="6" rx="3" fill="var(--color-live-soft)" />
    </svg>
  )
}
