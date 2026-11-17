const toCents = (value) => Math.round((Number(value) || 0) * 100)

/**
 * Splits one payment across invoices oldest first, each up to its balance, to the cent.
 * @param {Array<{id: string, txnDate: string, balance: number}>} invoices
 * @param {number} amount
 * @returns {Array<{invoiceId: string, amount: number}>}
 */
export function allocatePayment(invoices, amount) {
  const oldestFirst = [...invoices].sort((a, b) => (a.txnDate || '').localeCompare(b.txnDate || ''))
  let remainingCents = toCents(amount)
  const lines = []

  for (const invoice of oldestFirst) {
    if (remainingCents <= 0) break
    const appliedCents = Math.min(remainingCents, toCents(invoice.balance))
    if (appliedCents <= 0) continue
    lines.push({ invoiceId: invoice.id, amount: appliedCents / 100 })
    remainingCents -= appliedCents
  }

  return lines
}

export function sumBalances(invoices) {
  return invoices.reduce((cents, invoice) => cents + toCents(invoice.balance), 0) / 100
}
