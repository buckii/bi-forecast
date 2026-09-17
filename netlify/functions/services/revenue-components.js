// The six revenue components, as pure functions of already-fetched QuickBooks and Pipedrive data.
//
// NOTE: `isRevenueLine` here tests the account NAME against /^4\d{3}|revenue|income/, which is not
// the same rule as services/qb-accounts.js, which tests the account ID. Do not merge the two
// without checking real account data: they disagree on an account whose number and name differ.

const { addMonths, format } = require('date-fns')

function sumInvoices(invoices) {
  return invoices.reduce((sum, invoice) => {
    return sum + (invoice.TotalAmt || 0)
  }, 0)
}

function sumRevenueJournalEntries(entries) {
  if (!entries || entries.length === 0) {
    return 0
  }

  // Filter to only include entries with unearned revenue accounts (same as journal-entries-list endpoint)
  const entriesWithUnearned = entries.filter((entry) => {
    return entry.Line?.some((line) => {
      const accountName = line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || ''
      return accountName.includes('unearned') || accountName.includes('deferred')
    })
  })

  let total = 0
  for (const entry of entriesWithUnearned) {
    const lines = entry.Line || []

    for (const line of lines) {
      const accountRef = line.JournalEntryLineDetail?.AccountRef
      const postingType = line.JournalEntryLineDetail?.PostingType
      const accountName = accountRef?.name?.toLowerCase() || ''

      // Look for revenue accounts - match account number (^4\d{3}) or name contains revenue/income
      const isRevenueAccount =
        accountRef?.name?.match(/^4\d{3}|revenue|income/i) &&
        !accountName.includes('unearned') &&
        !accountName.includes('deferred')

      if (isRevenueAccount) {
        // IMPORTANT: In journal entries, Credits to revenue accounts increase revenue (positive)
        // Debits to revenue accounts decrease revenue (negative)
        const amount = line.Amount || 0

        // Credits to a revenue account increase revenue; debits reduce it. An unspecified
        // posting type is treated as a credit.
        if (postingType === 'Debit') {
          total -= amount
        } else {
          total += amount
        }
      }
    }
  }

  return total
}

function sumDelayedCharges(charges) {
  return charges.reduce((sum, charge) => {
    return sum + (charge.TotalAmt || 0)
  }, 0)
}

function calculateMonthlyRecurring(invoices) {
  if (!invoices || invoices.length === 0) return 0

  let total = 0
  for (const invoice of invoices) {
    const lines = invoice.Line || []
    for (const line of lines) {
      const accountRef = line.SalesItemLineDetail?.AccountRef || line.AccountBasedExpenseLineDetail?.AccountRef
      const itemRef = line.SalesItemLineDetail?.ItemRef

      // Check if account name or item name contains "monthly"
      const hasMonthly =
        accountRef?.name?.toLowerCase().includes('monthly') ||
        itemRef?.name?.toLowerCase().includes('monthly') ||
        line.Description?.toLowerCase().includes('monthly')

      if (hasMonthly) {
        total += line.Amount || 0
      }
    }
  }

  return total
}

function calculateWonUnscheduledForMonth(monthDate, wonUnscheduledDeals) {
  if (!wonUnscheduledDeals || wonUnscheduledDeals.length === 0) return 0

  const monthStr = format(monthDate, 'yyyy-MM')
  let total = 0

  for (const deal of wonUnscheduledDeals) {
    // Use string-based date parsing to avoid timezone issues
    const startDateStr = deal.projectStartDate || deal.wonTime || deal.expectedCloseDate
    if (!startDateStr) continue

    // Parse date components to avoid timezone conversion
    const [year, month, day] = startDateStr.split('T')[0].split('-').map(Number)
    const startDate = new Date(year, month - 1, day) // Local time construction

    const duration = Math.max(1, deal.duration || 1)
    const monthlyAmount = (deal.value || 0) / duration

    // Check if this month falls within the project duration
    for (let i = 0; i < duration; i++) {
      const projectMonth = addMonths(startDate, i)
      if (format(projectMonth, 'yyyy-MM') === monthStr) {
        total += monthlyAmount
        break // Only count once per deal per month
      }
    }
  }

  return Math.round(total)
}

function calculateWeightedSalesForMonth(monthDate, openDeals) {
  if (!openDeals || openDeals.length === 0) return 0

  const monthStr = format(monthDate, 'yyyy-MM')
  let total = 0

  for (const deal of openDeals) {
    if (!deal.expectedCloseDate) continue

    // Check if this deal should contribute to the current month
    // For multi-month deals, distribute across all months starting from close month forward
    const expectedCloseDate = new Date(deal.expectedCloseDate + 'T00:00:00')
    const duration = Math.max(1, deal.duration || 1)

    let shouldIncludeDeal = false

    // Check if current month falls within the project duration
    // Start from the close month and go forward for the duration
    const closeMonthDate = new Date(expectedCloseDate.getFullYear(), expectedCloseDate.getMonth(), 1)

    for (let i = 0; i < duration; i++) {
      const projectMonth = new Date(closeMonthDate)
      projectMonth.setMonth(projectMonth.getMonth() + i)
      const projectMonthStr = format(projectMonth, 'yyyy-MM')

      if (projectMonthStr === monthStr) {
        shouldIncludeDeal = true
        break
      }
    }

    if (!shouldIncludeDeal) continue

    // Calculate weighted value: total amount * probability / duration
    const baseWeightedValue = deal.weightedValue || (deal.value * (deal.probability || 0)) / 100
    const monthlyWeightedValue = baseWeightedValue / duration

    total += monthlyWeightedValue
  }

  return Math.round(total)
}

module.exports = {
  sumInvoices,
  sumRevenueJournalEntries,
  sumDelayedCharges,
  calculateMonthlyRecurring,
  calculateWonUnscheduledForMonth,
  calculateWeightedSalesForMonth,
}
