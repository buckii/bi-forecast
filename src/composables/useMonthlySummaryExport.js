import { format } from 'date-fns'
import { ref } from 'vue'
import { downloadCsv, toCsv } from '../lib/csv.js'
import { formatMonth } from '../lib/format.js'
import { createSpreadsheet } from '../lib/google-sheets.js'
import { useToast } from './useToast.js'

/** "Revenue by Client 2026-01 to 2026-12 as of 2026-09-29", dated in local time. */
export function monthlySummaryExportName(title, startMonth, endMonth, today = new Date()) {
  return `${title} ${startMonth} to ${endMonth} as of ${format(today, 'yyyy-MM-dd')}`
}

const roundTo = (value, places) => Math.round(value * 10 ** places) / 10 ** places

/** The summary as numbers in the selected units, so a spreadsheet can sum it. */
export function monthlySummaryTable({
  rows,
  labelField,
  labelHeader,
  monthKeys,
  monthTotals,
  grandTotal,
  isPoints,
  pricePerPoint,
}) {
  const toUnits = (amount) => {
    if (!amount) return ''
    return isPoints ? roundTo(amount / pricePerPoint, 1) : roundTo(amount, 2)
  }
  const share = (amount) => (grandTotal ? roundTo((amount / grandTotal) * 100, 1) : '')
  const monthValues = (months) => monthKeys.map((key) => toUnits(months[key]))

  const headers = [labelHeader, ...monthKeys.map(formatMonth), isPoints ? 'Total (points)' : 'Total', '% of Total']
  const tableRows = [
    ...rows.map((row) => [row[labelField], ...monthValues(row.months), toUnits(row.total), share(row.total)]),
    ['TOTAL', ...monthValues(monthTotals), toUnits(grandTotal), share(grandTotal)],
  ]
  const valuePattern = isPoints ? '#,##0.0' : '#,##0.00'
  const columnPatterns = [null, ...monthKeys.map(() => valuePattern), valuePattern, '0.0"%"']

  return { headers, tableRows, columnPatterns }
}

/**
 * CSV, PDF and Google Sheets exports of a monthly summary. `title`, `labelField` and `labelHeader`
 * are plain strings; every other argument is a ref or computed.
 */
export function useMonthlySummaryExport({
  title,
  labelField,
  labelHeader,
  rows,
  monthKeys,
  monthTotals,
  grandTotal,
  units,
  pricePerPoint,
  startMonth,
  endMonth,
}) {
  const toast = useToast()
  const creatingSheet = ref(false)
  const sheetUrl = ref('')

  const exportName = () => monthlySummaryExportName(title, startMonth.value, endMonth.value)

  const table = () =>
    monthlySummaryTable({
      rows: rows.value,
      labelField,
      labelHeader,
      monthKeys: monthKeys.value,
      monthTotals: monthTotals.value,
      grandTotal: grandTotal.value,
      isPoints: units.value === 'points',
      pricePerPoint: pricePerPoint.value,
    })

  function exportToCsv() {
    const { headers, tableRows } = table()
    downloadCsv(`${exportName().replaceAll(' ', '_').toLowerCase()}.csv`, toCsv(headers, tableRows))
  }

  function saveAsPdf() {
    // The browser names the saved PDF after the page title.
    const pageTitle = document.title
    document.title = exportName()
    window.print()
    document.title = pageTitle
  }

  async function openInGoogleSheets() {
    const { headers, tableRows, columnPatterns } = table()
    creatingSheet.value = true
    sheetUrl.value = ''

    try {
      sheetUrl.value = await createSpreadsheet(exportName(), [headers, ...tableRows], columnPatterns)
      // A blocked popup still leaves the link on the page.
      window.open(sheetUrl.value, '_blank', 'noopener')
    } catch (err) {
      console.error('Error creating the Google Sheet:', err)
      toast.error(`Could not create the Google Sheet: ${err.message}`, 8000)
    } finally {
      creatingSheet.value = false
    }
  }

  const exportOptions = [
    { label: 'Download CSV', action: exportToCsv },
    { label: 'Save as PDF', action: saveAsPdf },
    { label: 'Open in Google Sheets', action: openInGoogleSheets },
  ]

  return { exportOptions, creatingSheet, sheetUrl }
}
