// Formatters for function output. Self-contained CommonJS: a function that imports from the ESM
// frontend tree breaks the Netlify bundler, so this stays in lockstep with src/lib/format.js.

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
})

function formatCurrency(value) {
  return currency.format(value || 0)
}

/** `value` as a share of `total`, e.g. "12.5%". */
function formatPercent(value, total) {
  if (!total) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

module.exports = { formatCurrency, formatPercent }
