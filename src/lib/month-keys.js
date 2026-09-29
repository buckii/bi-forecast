// Arithmetic on 'YYYY-MM' month keys. Pure strings, so no timezone can move a month.

export function shiftMonth(monthKey, offset) {
  const [year, month] = monthKey.split('-').map(Number)
  const index = year * 12 + (month - 1) + offset
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Months from start through end, counting both. */
export function monthSpan(startMonth, endMonth) {
  const [startYear, startMonthNumber] = startMonth.split('-').map(Number)
  const [endYear, endMonthNumber] = endMonth.split('-').map(Number)
  return (endYear - startYear) * 12 + (endMonthNumber - startMonthNumber) + 1
}

/** Every month key from start through end, inclusive. */
export function monthsBetween(startMonth, endMonth) {
  return Array.from({ length: Math.max(0, monthSpan(startMonth, endMonth)) }, (_, index) =>
    shiftMonth(startMonth, index),
  )
}

// The window moves forward once today is this far into a quarter: the 15th of its middle month.
const SHIFT_MONTH_IN_QUARTER = 1
const SHIFT_DAY = 15

/**
 * Two quarters around `today` that keep at least a month and a half on each side of it: the previous
 * and current quarter until the middle of the current one, then the current and next.
 */
export function twoQuarterPeriod(today = new Date()) {
  const month = today.getMonth()
  const monthInQuarter = month % 3
  const pastMidQuarter =
    monthInQuarter > SHIFT_MONTH_IN_QUARTER ||
    (monthInQuarter === SHIFT_MONTH_IN_QUARTER && today.getDate() >= SHIFT_DAY)

  const currentQuarterStart = `${today.getFullYear()}-${String(month - monthInQuarter + 1).padStart(2, '0')}`
  const start = pastMidQuarter ? currentQuarterStart : shiftMonth(currentQuarterStart, -3)
  return { start, end: shiftMonth(start, 5) }
}
