// Builds QuickBooks journal entries. Every entry this app creates is one balanced debit/credit pair.

const { monthStartString } = require('../utils/dates.js')

const BALANCE_TOLERANCE = 0.01

function line(description, amount, postingType, accountId) {
  return {
    Description: description,
    Amount: amount,
    DetailType: 'JournalEntryLineDetail',
    JournalEntryLineDetail: {
      PostingType: postingType,
      AccountRef: { value: accountId },
    },
  }
}

/** One entry moving `amount` from `debitAccount` to `creditAccount`. */
function pairEntry({ date, note, description, amount, debitAccount, creditAccount }) {
  return {
    TxnDate: date,
    PrivateNote: note,
    Line: [line(description, amount, 'Debit', debitAccount), line(description, amount, 'Credit', creditAccount)],
  }
}

/** Lines for an entry the user composed in the edit modal. */
function buildLines(lines) {
  return lines.map((entryLine, index) => ({
    LineNum: index + 1,
    ...line(entryLine.description || '', entryLine.amount, entryLine.postingType, entryLine.accountId),
  }))
}

function sumBy(lines, postingType) {
  return lines
    .filter((entryLine) => entryLine.postingType === postingType)
    .reduce((total, entryLine) => total + entryLine.amount, 0)
}

function isBalanced(lines) {
  return Math.abs(sumBy(lines, 'Debit') - sumBy(lines, 'Credit')) <= BALANCE_TOLERANCE
}

/** SHIFT: moves revenue out of the invoice month and into the month the work happens. */
function buildShiftEntries(params, settings) {
  const { description, amount, invoiceDate, workDate } = params
  const revenueAccount = params.revenueAccountId || settings.projectIncomePoints
  const unearnedAccount = params.unearnedRevenueAccountId || settings.unearnedRevenue
  const note = `Revenue shift - ${description}`

  return [
    pairEntry({
      date: invoiceDate,
      note,
      description,
      amount,
      debitAccount: revenueAccount,
      creditAccount: unearnedAccount,
    }),
    pairEntry({
      date: workDate,
      note,
      description,
      amount,
      debitAccount: unearnedAccount,
      creditAccount: revenueAccount,
    }),
  ]
}

/**
 * SPREAD: defers everything past the first month on the invoice date, then recognizes one month at
 * a time. The first month is never journaled; the invoice already recognized it.
 */
function buildSpreadEntries(params, settings) {
  const { description, amount, invoiceDate, numberOfMonths, recognitionStartDate } = params
  const revenueAccount = params.revenueAccountId || settings.recurringIncomeSupport
  const unearnedAccount = params.unearnedRevenueAccountId || settings.unearnedRevenue

  const monthlyAmount = Math.ceil((amount / numberOfMonths) * 100) / 100
  const monthsToDefer = numberOfMonths - 1
  const deferralAmount = monthlyAmount * monthsToDefer

  const entries = []

  if (deferralAmount > 0) {
    const deferralDescription = `${description} - Deferral (${monthsToDefer} months)`
    entries.push(
      pairEntry({
        date: invoiceDate,
        note: `Revenue spreading - ${description} (deferral for ${monthsToDefer} months)`,
        description: deferralDescription,
        amount: deferralAmount,
        debitAccount: revenueAccount,
        creditAccount: unearnedAccount,
      }),
    )
  }

  for (let i = 0; i < monthsToDefer; i++) {
    // The final month absorbs the rounding remainder, or cents stay in unearned revenue forever.
    const isLastMonth = i === monthsToDefer - 1
    const monthAmount = isLastMonth ? deferralAmount - monthlyAmount * (monthsToDefer - 1) : monthlyAmount

    const monthLabel = `Month ${i + 2} of ${numberOfMonths}`

    entries.push(
      pairEntry({
        date: monthStartString(recognitionStartDate, i),
        note: `Revenue spreading - ${description} (month ${i + 2} of ${numberOfMonths})`,
        description: `${description} - ${monthLabel}`,
        amount: Math.abs(monthAmount),
        debitAccount: unearnedAccount,
        creditAccount: revenueAccount,
      }),
    )
  }

  return entries
}

module.exports = {
  pairEntry,
  buildLines,
  isBalanced,
  buildShiftEntries,
  buildSpreadEntries,
  BALANCE_TOLERANCE,
}
