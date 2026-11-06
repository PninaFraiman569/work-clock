// ייצוא לאקסל (xlsx) ישירות בדפדפן.
import type { DayNote, WorkSession } from '../api/types'
import {
  addDays,
  cycleRangeText,
  DAY_MS,
  formatDate,
  groupByDay,
  HEB_MONTHS,
  HEB_WEEKDAYS,
  parseDayKey,
  piecesInRange,
  sumMs,
  yearCycles,
  type Range,
} from './time'
import { hebrewDate } from './hebrew'

export interface ExportRequest {
  kind: 'day' | 'month' | 'year'
  title: string // למשל "נובמבר 2026"
  fileName: string
  range: Range
  sessions: WorkSession[]
  notes: DayNote[]
  userName: string
  startDay: number
  year?: number
}

const INK = 'FF1E2A5A'
const TINT = 'FFE8EBFC'
const SUNK = 'FFF4F6FA'

/** תאריך כערך UTC כדי שאקסל יציג אותו בדיוק כמו שהוא, בלי הזזה של אזור זמן */
const excelDate = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
/** שעה ביום כשבר של יממה */
const dayFraction = (d: Date) => (d.getHours() * 60 + d.getMinutes()) / 1440
/** משך מדויק כשבר של יממה, כדי שסיכום השורות באקסל יהיה זהה לסיכום באתר */
const durationValue = (ms: number) => ms / DAY_MS

export async function exportToExcel(req: ExportRequest) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'שעון עבודה'
  wb.created = new Date()
  const now = new Date()

  const pieces = piecesInRange(req.sessions, req.range, now)
  const byDay = groupByDay(pieces)
  const noteMap = new Map(req.notes.map((n) => [n.day, n.note]))

  type Sheet = ReturnType<typeof wb.addWorksheet>
  const styleHeader = (ws: Sheet, row: number) => {
    const r = ws.getRow(row)
    r.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } }
    r.alignment = { vertical: 'middle', horizontal: 'right' }
    r.height = 22
  }
  const addTitle = (ws: Sheet, cols: number, text: string) => {
    ws.mergeCells(1, 1, 1, cols)
    const c = ws.getCell(1, 1)
    c.value = text
    c.font = { bold: true, size: 14, color: { argb: INK } }
    c.alignment = { horizontal: 'right' }
    ws.getRow(1).height = 24
    ws.mergeCells(2, 1, 2, cols)
    const sub = ws.getCell(2, 1)
    sub.value = `${req.userName}  |  ${formatDate(req.range.start)} – ${formatDate(addDays(req.range.end, -1))}`
    sub.font = { color: { argb: 'FF5D6787' } }
    sub.alignment = { horizontal: 'right' }
  }

  // בייצוא שנתי, גיליון הסיכום החודשי ראשון
  const ws3 =
    req.kind === 'year' ? wb.addWorksheet('סיכום חודשי', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }] }) : null

  // ---------- גיליון 1: כל המקטעים ----------
  const ws = wb.addWorksheet('רישומים', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }] })
  ws.columns = [
    { key: 'date', width: 13 },
    { key: 'heb', width: 20 },
    { key: 'weekday', width: 9 },
    { key: 'start', width: 9 },
    { key: 'end', width: 9 },
    { key: 'dur', width: 10 },
    { key: 'desc', width: 48 },
  ]
  addTitle(ws, 7, `שעות עבודה: ${req.title}`)
  ws.getRow(3).values = ['תאריך', 'תאריך עברי', 'יום', 'התחלה', 'סיום', 'משך', 'מה עשיתי']
  styleHeader(ws, 3)

  let r = 4
  const firstDataRow = r
  for (const p of pieces) {
    const d = parseDayKey(p.day)
    const row = ws.getRow(r)
    row.values = [
      excelDate(d),
      hebrewDate(d),
      HEB_WEEKDAYS[d.getDay()],
      dayFraction(p.start),
      p.running && !p.continuesToNext ? 'פעיל' : p.continuesToNext ? '24:00' : dayFraction(p.end),
      durationValue(p.ms),
      p.session.description || '',
    ]
    row.getCell(1).numFmt = 'dd/mm/yyyy'
    row.getCell(4).numFmt = 'hh:mm'
    row.getCell(5).numFmt = 'hh:mm'
    row.getCell(6).numFmt = '[h]:mm:ss'
    row.alignment = { horizontal: 'right' }
    row.getCell(7).alignment = { horizontal: 'right', wrapText: true }
    r++
  }
  const lastDataRow = r - 1
  const totalRow = ws.getRow(r)
  totalRow.getCell(1).value = 'סה״כ'
  totalRow.getCell(6).value =
    lastDataRow >= firstDataRow
      ? { formula: `SUM(F${firstDataRow}:F${lastDataRow})`, result: durationValue(sumMs(pieces)) }
      : 0
  totalRow.getCell(6).numFmt = '[h]:mm:ss'
  totalRow.font = { bold: true }
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } }
  totalRow.alignment = { horizontal: 'right' }

  // ---------- גיליון 2: סיכום יומי ----------
  const days = Array.from(new Set([...byDay.keys(), ...noteMap.keys()])).sort()
  const ws2 = wb.addWorksheet('סיכום יומי', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }] })
  ws2.columns = [
    { key: 'date', width: 13 },
    { key: 'heb', width: 20 },
    { key: 'weekday', width: 9 },
    { key: 'segments', width: 10 },
    { key: 'total', width: 11 },
    { key: 'note', width: 48 },
  ]
  addTitle(ws2, 6, `סיכום יומי: ${req.title}`)
  ws2.getRow(3).values = ['תאריך', 'תאריך עברי', 'יום', 'מקטעים', 'סה״כ שעות', 'הערה ליום']
  styleHeader(ws2, 3)
  r = 4
  for (const key of days) {
    const d = parseDayKey(key)
    const list = byDay.get(key) ?? []
    const row = ws2.getRow(r)
    row.values = [excelDate(d), hebrewDate(d), HEB_WEEKDAYS[d.getDay()], list.length, durationValue(sumMs(list)), noteMap.get(key) ?? '']
    row.getCell(1).numFmt = 'dd/mm/yyyy'
    row.getCell(5).numFmt = '[h]:mm:ss'
    row.alignment = { horizontal: 'right' }
    row.getCell(6).alignment = { horizontal: 'right', wrapText: true }
    r++
  }
  const t2 = ws2.getRow(r)
  t2.getCell(1).value = 'סה״כ'
  t2.getCell(4).value = byDay.size ? `${byDay.size} ימים` : ''
  t2.getCell(5).value = days.length ? { formula: `SUM(E4:E${r - 1})`, result: durationValue(sumMs(pieces)) } : 0
  t2.getCell(5).numFmt = '[h]:mm:ss'
  t2.font = { bold: true }
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } }
  t2.alignment = { horizontal: 'right' }

  // ---------- גיליון 3 (שנה): סיכום חודשי ----------
  if (ws3 && req.year) {
    ws3.columns = [
      { key: 'month', width: 12 },
      { key: 'range', width: 16 },
      { key: 'days', width: 11 },
      { key: 'total', width: 12 },
    ]
    addTitle(ws3, 4, `סיכום חודשי: ${req.year}`)
    ws3.getRow(3).values = ['חודש', 'תאריכים', 'ימי עבודה', 'סה״כ שעות']
    styleHeader(ws3, 3)
    r = 4
    let sum = 0
    for (const c of yearCycles(req.year, req.startDay)) {
      const ps = piecesInRange(req.sessions, c, now)
      const ms = sumMs(ps)
      sum += ms
      const row = ws3.getRow(r)
      row.values = [HEB_MONTHS[c.labelMonth], cycleRangeText(c), groupByDay(ps).size, durationValue(ms)]
      row.getCell(4).numFmt = '[h]:mm:ss'
      row.alignment = { horizontal: 'right' }
      if (r % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUNK } }
      r++
    }
    const t3 = ws3.getRow(r)
    t3.getCell(1).value = 'סה״כ'
    t3.getCell(3).value = { formula: `SUM(C4:C${r - 1})`, result: byDay.size }
    t3.getCell(4).value = { formula: `SUM(D4:D${r - 1})`, result: durationValue(sum) }
    t3.getCell(4).numFmt = '[h]:mm:ss'
    t3.font = { bold: true }
    t3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINT } }
    t3.alignment = { horizontal: 'right' }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = req.fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

