// Revenue as it stood on a past date: the most recent archive at or before it.
const { createHandler, HttpError } = require('./utils/handler.js')
const { findArchiveOnOrBefore, toRevenueResponse } = require('./services/archives.js')

exports.handler = createHandler({ errorMessage: 'Failed to get historical revenue data' }, async ({ company, query }) => {
  const { date } = query
  if (!date) throw new HttpError('Date parameter is required', 400)

  // Accept an ISO timestamp as well as YYYY-MM-DD; only the calendar day matters.
  const archive = await findArchiveOnOrBefore(company._id, date.split('T')[0])

  if (!archive) {
    throw new HttpError('No historical data found for the requested date', 404)
  }

  return toRevenueResponse(archive, {
    archiveDate: archive.archiveDate,
    lastUpdated: archive.createdAt
  })
})
