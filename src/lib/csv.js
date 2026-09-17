// Minimal CSV writing. Only fields that need quoting get it, so numeric columns stay numeric
// when a spreadsheet opens the file.

const NEEDS_QUOTING = /[",\n\r]/

export function csvField(value) {
  if (value === null || value === undefined) return ''

  const text = String(value)
  return NEEDS_QUOTING.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\n')
}

/** Hand the file to the browser as a download. */
export function downloadCsv(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
