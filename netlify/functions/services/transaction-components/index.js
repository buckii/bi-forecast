// One fetcher per revenue component, behind a single signature so the endpoint dispatches
// on a key rather than a switch. The six keys match the components in CLAUDE.md.

const {
  getInvoicedTransactions,
  getJournalEntryTransactions,
  getDelayedChargeTransactions,
} = require('./quickbooks.js')
const { getMonthlyRecurringTransactions } = require('./recurring.js')
const { getWonUnscheduledTransactions, getWeightedSalesTransactions } = require('./pipedrive.js')

const COMPONENT_FETCHERS = {
  invoiced: ({ calculator, startDate, endDate, asOf }) => getInvoicedTransactions(calculator, startDate, endDate, asOf),
  journalEntries: ({ calculator, startDate, endDate, asOf }) =>
    getJournalEntryTransactions(calculator, startDate, endDate, asOf),
  delayedCharges: ({ calculator, startDate, endDate, asOf }) =>
    getDelayedChargeTransactions(calculator, startDate, endDate, asOf),
  monthlyRecurring: ({ calculator, startDate, endDate, monthDate, asOf }) =>
    getMonthlyRecurringTransactions(calculator, startDate, endDate, monthDate, asOf),
  wonUnscheduled: ({ calculator, monthDate, asOf }) => getWonUnscheduledTransactions(calculator, monthDate, asOf),
  weightedSales: ({ calculator, monthDate, asOf }) => getWeightedSalesTransactions(calculator, monthDate, asOf),
}

const COMPONENT_NAMES = Object.keys(COMPONENT_FETCHERS)

module.exports = { COMPONENT_FETCHERS, COMPONENT_NAMES }
