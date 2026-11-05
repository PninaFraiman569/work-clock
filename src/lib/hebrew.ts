// תאריך עברי בגימטריה (למשל: כ״ה בחשוון תשפ״ז), על בסיס לוח השנה העברי המובנה בדפדפן.

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת']

function letters(n: number): string {
  let out = ''
  let rest = n
  while (rest >= 400) {
    out += 'ת'
    rest -= 400
  }
  if (rest >= 100) {
    out += HUNDREDS[Math.floor(rest / 100)]
    rest %= 100
  }
  // ט״ו וט״ז במקום צירופים של שם השם
  if (rest === 15) return out + 'טו'
  if (rest === 16) return out + 'טז'
  out += TENS[Math.floor(rest / 10)] + ONES[rest % 10]
  return out
}

export function gematria(n: number): string {
  const s = letters(n)
  if (s.length === 1) return s + '׳'
  return s.slice(0, -1) + '״' + s.slice(-1)
}

const fmt = new Intl.DateTimeFormat('he-IL-u-ca-hebrew-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const cache = new Map<string, { day: string; month: string; year: string }>()

function parts(d: Date) {
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const hit = cache.get(key)
  if (hit) return hit
  let day = 0
  let month = ''
  let year = 0
  for (const p of fmt.formatToParts(d)) {
    if (p.type === 'day') day = Number(p.value)
    else if (p.type === 'month') month = p.value
    else if (p.type === 'year' || (p.type as string) === 'relatedYear') year = Number(p.value)
  }
  const res = { day: gematria(day), month, year: gematria(year % 1000) }
  cache.set(key, res)
  return res
}

/** כ״ה בחשוון */
export function hebrewDayMonth(d: Date): string {
  const p = parts(d)
  return `${p.day} ${p.month}`
}

/** כ״ה בחשוון תשפ״ז */
export function hebrewDate(d: Date): string {
  const p = parts(d)
  return `${p.day} ${p.month} ${p.year}`
}
