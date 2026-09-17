// UTC helpers for date-only (YYYY-MM-DD) values. A date crossing the API boundary is a calendar
// date, not an instant, and local-timezone methods shift it by a day.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const MONTH_ONLY = /^\d{4}-\d{2}$/

function isDateOnly(value) {
  return typeof value === 'string' && DATE_ONLY.test(value)
}

/** 'YYYY-MM-DD' (or 'YYYY-MM') -> Date at UTC midnight. */
function parseDate(value) {
  if (value instanceof Date) return value
  if (typeof value !== 'string') throw new Error(`Invalid date: ${value}`)

  const normalized = MONTH_ONLY.test(value) ? `${value}-01` : value
  if (!DATE_ONLY.test(normalized)) throw new Error(`Invalid date format (expected YYYY-MM-DD): ${value}`)

  const [year, month, day] = normalized.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

/** Date -> 'YYYY-MM-DD', using UTC components. */
function toDateString(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 'YYYY-MM' for a date or a date-only string. */
function toMonthKey(value) {
  return toDateString(parseDate(value)).slice(0, 7)
}

/** First of the month containing `value`, as a Date. */
function startOfMonth(value) {
  const date = parseDate(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/** Adds months from the 1st, so a short month never rolls the day forward. */
function addMonths(value, months) {
  const start = startOfMonth(value)
  start.setUTCMonth(start.getUTCMonth() + months)
  return start
}

/** The 1st of the month `offset` months out: the only date a journal entry line may carry. */
function monthStartString(value, offset = 0) {
  return toDateString(addMonths(value, offset))
}

/** Add days in UTC. */
function addDays(value, days) {
  const date = parseDate(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days))
}

/** Shift a 'YYYY-MM' key by `offset` months. */
function shiftMonthKey(monthKey, offset) {
  return toMonthKey(addMonths(monthKey, offset))
}

/** Today as 'YYYY-MM-DD' in UTC. */
function todayString() {
  return toDateString(new Date())
}

/** UTC midnight: the form archive and cache documents are keyed by. */
function startOfDay(value) {
  const date = value instanceof Date ? value : parseDate(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/** UTC midnight today. */
function todayDate() {
  return parseDate(todayString())
}

module.exports = {
  isDateOnly,
  parseDate,
  toDateString,
  toMonthKey,
  startOfMonth,
  addMonths,
  addDays,
  monthStartString,
  shiftMonthKey,
  todayString,
  startOfDay,
  todayDate
}
