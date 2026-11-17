// Grouping transactions by client. The drill-down's Clients tab and the monthly client summary both
// group through here, so a client lands on the same row in each.

// Matches the page, which leaves a cell under half a dollar blank.
const ZERO_TOLERANCE = 0.5

/**
 * Invoices carry the raw QuickBooks name and journal entries the matched primary name, so the
 * alias-resolved name is what puts a revenue shift on the same row as the client's invoices.
 */
export function clientName(transaction) {
  return transaction.clientNormalized || transaction.customer || 'Unknown Client'
}

/** @returns {{client: string, total: number}[]} */
export function totalsByClient(transactions, enabledTypes) {
  const totals = new Map()

  for (const transaction of transactions) {
    if (!enabledTypes[transaction.type]) continue
    const name = clientName(transaction)
    totals.set(name, (totals.get(name) || 0) + (transaction.amount || 0))
  }

  return [...totals].map(([client, total]) => ({ client, total }))
}

/**
 * One row per client with an amount per month key. A client whose every month nets to zero is
 * dropped; a shift that nets to zero across months still shows, because each month is nonzero.
 *
 * @param {Record<string, object[]>} transactionsByMonth
 * @returns {{client: string, months: Record<string, number>, total: number}[]}
 */
export function monthlyClientRows(transactionsByMonth, monthKeys, enabledTypes) {
  const rows = new Map()

  for (const monthKey of monthKeys) {
    for (const { client, total } of totalsByClient(transactionsByMonth[monthKey] || [], enabledTypes)) {
      const row = rows.get(client) || { client, months: {}, total: 0 }
      row.months[monthKey] = total
      row.total += total
      rows.set(client, row)
    }
  }

  return [...rows.values()].filter((row) =>
    Object.values(row.months).some((amount) => Math.abs(amount) >= ZERO_TOLERANCE),
  )
}
