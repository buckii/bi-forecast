// Which QuickBooks lines count as unearned revenue, revenue, and monthly recurring revenue.

function accountName(line) {
  return line?.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || ''
}

function accountId(line) {
  return line?.JournalEntryLineDetail?.AccountRef?.value || ''
}

/** The liability side of a revenue recognition entry. */
function isUnearnedRevenueLine(line) {
  const name = accountName(line)
  return name.includes('unearned') || name.includes('deferred')
}

/** A 4xxx, revenue, or income account that is not the unearned side. */
function isRevenueLine(line) {
  if (isUnearnedRevenueLine(line)) return false
  const name = accountName(line)
  return accountId(line).startsWith('4') || name.includes('revenue') || name.includes('income')
}

/** Only an entry touching unearned revenue represents recognition. */
function hasUnearnedRevenue(entry) {
  return entry.Line?.some(isUnearnedRevenueLine) || false
}

/** Signed revenue impact: credits to revenue increase it, debits reduce it. */
function revenueAmount(entry) {
  return (entry.Line || []).reduce((total, line) => {
    if (!isRevenueLine(line)) return total
    const amount = line.Amount || 0
    return line.JournalEntryLineDetail?.PostingType === 'Credit' ? total + amount : total - amount
  }, 0)
}

const MONTHLY = 'monthly'
const REVENUE_ACCOUNT_NAME = /^4\d{3}|revenue|income/i

/** An invoice line billed as monthly recurring: "monthly" in its account, item or description. */
function isMonthlyInvoiceLine(line) {
  const account = line?.SalesItemLineDetail?.AccountRef || line?.AccountBasedExpenseLineDetail?.AccountRef
  return [account?.name, line?.SalesItemLineDetail?.ItemRef?.name, line?.Description].some((text) =>
    text?.toLowerCase().includes(MONTHLY),
  )
}

function monthlyInvoiceAmount(invoice) {
  return (invoice.Line || []).filter(isMonthlyInvoiceLine).reduce((total, line) => total + (line.Amount || 0), 0)
}

/** A journal line on a revenue account whose name says monthly, excluding the unearned side. */
function isMonthlyRevenueJournalLine(line) {
  const name = line?.JournalEntryLineDetail?.AccountRef?.name || ''
  return REVENUE_ACCOUNT_NAME.test(name) && name.toLowerCase().includes(MONTHLY) && !isUnearnedRevenueLine(line)
}

/** Signed, like revenueAmount: a credit adds monthly revenue, a debit takes it away. */
function monthlyJournalLineAmount(line) {
  const amount = line.Amount || 0
  return line.JournalEntryLineDetail?.PostingType === 'Credit' ? amount : -amount
}

function monthlyJournalAmount(entry) {
  return (entry.Line || [])
    .filter(isMonthlyRevenueJournalLine)
    .reduce((total, line) => total + monthlyJournalLineAmount(line), 0)
}

module.exports = {
  accountName,
  accountId,
  isUnearnedRevenueLine,
  isRevenueLine,
  hasUnearnedRevenue,
  revenueAmount,
  isMonthlyInvoiceLine,
  monthlyInvoiceAmount,
  isMonthlyRevenueJournalLine,
  monthlyJournalLineAmount,
  monthlyJournalAmount,
}
