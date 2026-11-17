const { addDays, monthStartString, toDateString } = require('../utils/dates.js')

const MONTH_KEY = /^\d{4}-\d{2}$/
const MAX_MONTHS = 24
// Matches the page, which leaves a cell under half a dollar blank.
const ZERO_TOLERANCE = 0.5

const monthIndex = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number)
  return year * 12 + month
}

/** @returns {string|null} what is wrong with the period, or null when it can be fetched */
function validatePeriod(start, end) {
  if (!MONTH_KEY.test(start || '') || !MONTH_KEY.test(end || '')) return 'start and end must be YYYY-MM'
  const span = monthIndex(end) - monthIndex(start) + 1
  if (span < 1) return 'end must not be before start'
  if (span > MAX_MONTHS) return `The period can be at most ${MAX_MONTHS} months`
  return null
}

/** First day of the start month through the last day of the end month. */
function periodDates(start, end) {
  return {
    startDate: `${start}-01`,
    endDate: toDateString(addDays(monthStartString(`${end}-01`, 1), -1)),
  }
}

function parseAmount(value) {
  const amount = parseFloat(String(value ?? '').replace(/[,$]/g, ''))
  return Number.isFinite(amount) ? amount : 0
}

function monthColumns(report) {
  const columns = report?.Columns?.Column
  if (!Array.isArray(columns)) throw new Error('Unexpected Expenses by Vendor report: it has no columns')

  return columns
    .map((column, index) => {
      const startDate = column.MetaData?.find((meta) => meta.Name === 'StartDate')?.Value
      return column.ColType === 'Money' && startDate ? { index, monthKey: startDate.slice(0, 7) } : null
    })
    .filter(Boolean)
}

/**
 * The Expenses by Vendor Summary, summarized by month, as one row per vendor. A vendor whose every
 * month is zero is dropped.
 * @returns {{monthKeys: string[], vendors: {vendor: string, vendorId: string|null, months: Record<string, number>, total: number}[]}}
 */
function parseVendorExpensesReport(report) {
  const columns = monthColumns(report)
  const rows = report?.Rows?.Row || []
  const vendors = []

  for (const row of rows) {
    if (!Array.isArray(row.ColData)) continue

    const months = {}
    let total = 0
    for (const { index, monthKey } of columns) {
      const amount = parseAmount(row.ColData[index]?.value)
      if (!amount) continue
      months[monthKey] = amount
      total += amount
    }

    if (!Object.values(months).some((amount) => Math.abs(amount) >= ZERO_TOLERANCE)) continue
    vendors.push({
      vendor: row.ColData[0]?.value || 'Not Specified',
      vendorId: row.ColData[0]?.id || null,
      months,
      total,
    })
  }

  return { monthKeys: columns.map((column) => column.monthKey), vendors }
}

module.exports = { parseVendorExpensesReport, periodDates, validatePeriod }
