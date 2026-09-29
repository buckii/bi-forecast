// Display formatters, one definition each.

const currencyFormatters = new Map()

function currencyFormatter(fractionDigits) {
  if (!currencyFormatters.has(fractionDigits)) {
    currencyFormatters.set(
      fractionDigits,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
    )
  }
  return currencyFormatters.get(fractionDigits)
}

/** Whole dollars: the default wherever money is summarized. */
export function formatCurrency(value) {
  return currencyFormatter(0).format(value || 0)
}

/** Dollars and cents, for figures that must reconcile to the penny. */
export function formatCurrencyCents(value) {
  return currencyFormatter(2).format(value || 0)
}

export function formatPercent(value, digits = 0) {
  return `${(value || 0).toFixed(digits)}%`
}

/** `value` as a share of `total`, e.g. "12.5%". */
export function formatShare(value, total) {
  if (!total) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

const wholeNumberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Whole dollars with no symbol, for dense tables: "12,500". */
export function formatWholeDollars(value) {
  return wholeNumberFormatter.format(value || 0)
}

const pointsFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Dollars as points at the company's price per point: "22.7". */
export function formatPoints(value, pricePerPoint) {
  return pointsFormatter.format((value || 0) / pricePerPoint)
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value || 0)
}

/**
 * A date-only string is a calendar date, so it is built in local time. `new Date('2026-09-01')` is
 * UTC midnight, which renders as Aug 31 in every US timezone.
 */
export function parseDisplayDate(value) {
  if (!value) return null
  if (value instanceof Date) return value

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const dateFormatters = new Map()

function dateFormatter(options) {
  const key = JSON.stringify(options)
  if (!dateFormatters.has(key)) {
    dateFormatters.set(key, new Intl.DateTimeFormat('en-US', options))
  }
  return dateFormatters.get(key)
}

/** "Sep 1, 2026" */
export function formatDate(value) {
  const date = parseDisplayDate(value)
  if (!date) return ''
  return dateFormatter({ year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

/** "September 1, 2026" */
export function formatDateLong(value) {
  const date = parseDisplayDate(value)
  if (!date) return ''
  return dateFormatter({ year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}

/** "Sep 29, 8:03 AM", in local time, for a full timestamp. */
export function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (!value || Number.isNaN(date.getTime())) return ''
  return dateFormatter({ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

/** "Sep 2026", from a YYYY-MM month key or a date. */
export function formatMonth(value) {
  const date = parseDisplayDate(/^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value)
  if (!date) return ''
  return dateFormatter({ year: 'numeric', month: 'short' }).format(date)
}

export default {
  formatCurrency,
  formatCurrencyCents,
  formatPercent,
  formatShare,
  formatWholeDollars,
  formatPoints,
  formatNumber,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatMonth,
  parseDisplayDate,
}
