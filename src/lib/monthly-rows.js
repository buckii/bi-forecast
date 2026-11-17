// Rows of `{ [labelField]: string, months: { 'YYYY-MM': number }, total: number }`, shared by the
// Revenue by Client and Expenses by Vendor tables.

const MONTH_KEY = /^\d{4}-\d{2}$/

export function isMonthKey(value) {
  return MONTH_KEY.test(value)
}

/**
 * Sort by the label field, 'amount' (the row total) or a month key. Ties fall back to the label,
 * so rows with the same amount stay in a predictable order.
 */
export function sortMonthlyRows(rows, sortBy, direction, labelField) {
  const sign = direction === 'desc' ? -1 : 1
  const value = (row) => (isMonthKey(sortBy) ? row.months[sortBy] || 0 : row.total)
  const byLabel = (first, second) => first[labelField].localeCompare(second[labelField])

  return [...rows].sort((first, second) => {
    if (sortBy === labelField) return sign * byLabel(first, second)
    return sign * (value(first) - value(second)) || byLabel(first, second)
  })
}

/** @returns {{monthTotals: Record<string, number>, grandTotal: number}} */
export function monthlyTotals(rows, monthKeys) {
  const monthTotals = Object.fromEntries(
    monthKeys.map((monthKey) => [monthKey, rows.reduce((sum, row) => sum + (row.months[monthKey] || 0), 0)]),
  )
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0)
  return { monthTotals, grandTotal }
}
