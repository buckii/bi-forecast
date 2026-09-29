// The six revenue components, as pure functions of already-fetched QuickBooks and Pipedrive data.
//
// NOTE: `isRevenueLine` here tests the account NAME against /^4\d{3}|revenue|income/, which is not
// the same rule as services/qb-accounts.js, which tests the account ID. Do not merge the two
// without checking real account data: they disagree on an account whose number and name differ.

const { format } = require('date-fns')
const { monthlyInvoiceAmount, monthlyJournalAmount } = require('./qb-accounts.js')
const { isInMonth } = require('../utils/dates.js')

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
  return (invoices || []).reduce((total, invoice) => total + monthlyInvoiceAmount(invoice), 0)
}

/** Monthly recurring billed in one 'YYYY-MM' month, from invoices and journal entries alike. */
function monthlyRecurringBilled(qboData, monthKey) {
  const invoices = (qboData?.invoices || []).filter((invoice) => isInMonth(invoice.TxnDate, monthKey))
  const entries = (qboData?.journalEntries || []).filter((entry) => isInMonth(entry.TxnDate, monthKey))
  return calculateMonthlyRecurring(invoices) + entries.reduce((total, entry) => total + monthlyJournalAmount(entry), 0)
}

const toCents = (value) => Math.round(value * 100) / 100

/** Whole months from the month of a 'YYYY-MM-DD' date to a 'YYYY-MM' month key. */
function monthsBetweenKeys(dateString, monthKey) {
  const [startYear, startMonth] = dateString.slice(0, 7).split('-').map(Number)
  const [year, month] = monthKey.split('-').map(Number)
  return (year - startYear) * 12 + (month - startMonth)
}

/**
 * One month's share of an amount spread evenly from a start month, in cents, or null when the
 * spread does not reach that month. The last month takes the rounding remainder, so the shares
 * add back up to the whole amount.
 */
function spreadShare(amount, startDateString, duration, monthKey) {
  if (!startDateString) return null

  const months = Math.max(1, duration || 1)
  const index = monthsBetweenKeys(startDateString, monthKey)
  // A date that is not 'YYYY-MM…' gives NaN, which would pass both range checks below.
  if (!Number.isInteger(index) || index < 0 || index >= months) return null

  const share = toCents(amount / months)
  return index === months - 1 ? toCents(amount - share * (months - 1)) : share
}

/** A won deal not yet invoiced, spread across its project from the start date. */
function wonUnscheduledShare(deal, monthKey) {
  const startDate = deal.projectStartDate || deal.wonTime || deal.expectedCloseDate
  return spreadShare(deal.value || 0, startDate, deal.duration, monthKey)
}

function dealWeightedValue(deal) {
  return deal.weightedValue || ((deal.value || 0) * (deal.probability || 0)) / 100
}

/** An open deal's weighted value, spread across its project from the expected close. */
function weightedSalesShare(deal, monthKey) {
  return spreadShare(dealWeightedValue(deal), deal.expectedCloseDate, deal.duration, monthKey)
}

function sumShares(deals, monthDate, share) {
  const monthKey = format(monthDate, 'yyyy-MM')
  return toCents((deals || []).reduce((total, deal) => total + (share(deal, monthKey) || 0), 0))
}

function calculateWonUnscheduledForMonth(monthDate, wonUnscheduledDeals) {
  return sumShares(wonUnscheduledDeals, monthDate, wonUnscheduledShare)
}

function calculateWeightedSalesForMonth(monthDate, openDeals) {
  return sumShares(openDeals, monthDate, weightedSalesShare)
}

module.exports = {
  sumInvoices,
  sumRevenueJournalEntries,
  sumDelayedCharges,
  calculateMonthlyRecurring,
  monthlyRecurringBilled,
  calculateWonUnscheduledForMonth,
  calculateWeightedSalesForMonth,
  monthsBetweenKeys,
  wonUnscheduledShare,
  weightedSalesShare,
  dealWeightedValue,
}
