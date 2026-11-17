const { isDateOnly } = require('../utils/dates.js')

const QB_PAYMENT_METHODS = {
  check: 'Check',
  ach: 'Electronic Payment',
  credit_card: 'Credit Card',
  cash: 'Cash',
  other: 'Other',
}

const toCents = (value) => Math.round(value * 100)
const isPositiveNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0

/** @returns {string|null} what is wrong with the payment, or null when it can be recorded */
function validatePayment(body = {}) {
  const { customerId, amount, paymentMethod, paymentDate, lines } = body

  if (!customerId) return 'A customer is required'
  if (!isPositiveNumber(amount)) return 'Amount must be greater than zero'
  if (!QB_PAYMENT_METHODS[paymentMethod]) return 'Unknown payment method'
  if (!isDateOnly(paymentDate)) return 'Payment date must be YYYY-MM-DD'
  if (!Array.isArray(lines) || lines.length === 0) return 'At least one invoice is required'

  const linesAreValid = lines.every((line) => line?.invoiceId && isPositiveNumber(line.amount))
  if (!linesAreValid) return 'Each invoice needs an id and an amount greater than zero'

  const appliedCents = lines.reduce((cents, line) => cents + toCents(line.amount), 0)
  if (appliedCents !== toCents(amount)) return 'Invoice amounts must add up to the payment amount'

  return null
}

module.exports = { QB_PAYMENT_METHODS, validatePayment }
