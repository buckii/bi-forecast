const { createHandler, HttpError } = require('./utils/handler.js')
const QuickBooksService = require('./services/quickbooks.js')
const { parseVendorExpensesReport, periodDates, validatePeriod } = require('./services/vendor-expenses.js')

exports.handler = createHandler({ errorMessage: 'Failed to load expenses by vendor' }, async ({ company, query }) => {
  const problem = validatePeriod(query.start, query.end)
  if (problem) throw new HttpError(problem, 400)

  const { startDate, endDate } = periodDates(query.start, query.end)
  const report = await new QuickBooksService(company._id).getVendorExpenses(startDate, endDate)

  return {
    ...parseVendorExpensesReport(report),
    reportBasis: report.Header?.ReportBasis || null,
    fetchedAt: new Date().toISOString(),
  }
})
