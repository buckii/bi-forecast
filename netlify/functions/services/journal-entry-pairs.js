// Finds revenue shifts: two journal entries that cancel out in unearned revenue, so the UI can show
// one "moved $5,000 from June to August" row rather than two unexplained entries.

const { isUnearnedRevenueLine, isRevenueLine } = require('./qb-accounts.js')

const PAIR_WINDOW_DAYS = 60
const AMOUNT_TOLERANCE = 0.01

/** Attaches the two lines that carry the shift, so callers need not rescan. */
function withKeyLines(entry) {
  return {
    ...entry,
    unearnedRevenueLine: entry.Line.find(isUnearnedRevenueLine),
    revenueLine: entry.Line.find(isRevenueLine),
  }
}

function daysApart(firstDate, secondDate) {
  return Math.abs((new Date(firstDate) - new Date(secondDate)) / (1000 * 60 * 60 * 24))
}

function isPair(entry, candidate) {
  const unearned = entry.unearnedRevenueLine
  const candidateUnearned = candidate.unearnedRevenueLine

  return (
    Math.abs(unearned.Amount - candidateUnearned.Amount) < AMOUNT_TOLERANCE &&
    unearned.Description === candidateUnearned.Description &&
    unearned.JournalEntryLineDetail.PostingType !== candidateUnearned.JournalEntryLineDetail.PostingType &&
    entry.revenueLine.JournalEntryLineDetail.AccountRef.value ===
      candidate.revenueLine.JournalEntryLineDetail.AccountRef.value &&
    daysApart(entry.TxnDate, candidate.TxnDate) <= PAIR_WINDOW_DAYS
  )
}

function monthKey(txnDate) {
  return String(txnDate).slice(0, 7)
}

function buildPair(entry, candidate) {
  const isDebitFirst = entry.unearnedRevenueLine.JournalEntryLineDetail.PostingType === 'Debit'
  const debitEntry = isDebitFirst ? entry : candidate
  const creditEntry = isDebitFirst ? candidate : entry

  return {
    pairId: `${entry.Id}-${candidate.Id}`,
    amount: entry.unearnedRevenueLine.Amount,
    description: entry.unearnedRevenueLine.Description,
    debitEntry,
    creditEntry,
    netEffect: {
      fromMonth: monthKey(creditEntry.TxnDate),
      toMonth: monthKey(debitEntry.TxnDate),
      amount: entry.unearnedRevenueLine.Amount,
    },
  }
}

/**
 * @param {object[]} entries
 * @returns {{ paired: object[], unpaired: object[] }}
 */
function detectPairs(entries) {
  const annotated = entries.map(withKeyLines)
  const paired = []
  const unpaired = []
  const used = new Set()

  annotated.forEach((entry, i) => {
    if (used.has(i)) return

    if (!entry.unearnedRevenueLine || !entry.revenueLine) {
      unpaired.push(entry)
      return
    }

    const matchIndex = annotated.findIndex(
      (candidate, j) =>
        j > i && !used.has(j) && candidate.unearnedRevenueLine && candidate.revenueLine && isPair(entry, candidate),
    )

    if (matchIndex === -1) {
      unpaired.push(entry)
      return
    }

    paired.push(buildPair(entry, annotated[matchIndex]))
    used.add(i)
    used.add(matchIndex)
  })

  return { paired, unpaired }
}

module.exports = { detectPairs, withKeyLines, PAIR_WINDOW_DAYS }
