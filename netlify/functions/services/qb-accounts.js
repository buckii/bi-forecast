// Which QuickBooks journal entry lines count as unearned revenue and which count as revenue.

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

module.exports = {
  accountName,
  accountId,
  isUnearnedRevenueLine,
  isRevenueLine,
  hasUnearnedRevenue,
  revenueAmount
}
