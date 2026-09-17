// Access to the `revenue_archives` collection. Every archive is keyed by UTC midnight.

const { getCollection } = require('../utils/database.js')
const { startOfDay, todayDate } = require('../utils/dates.js')

/** The shape consumers expect when an archive records no exceptions. */
function emptyExceptions() {
  return { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] }
}

function emptyBalances() {
  return { assets: [], receivables: null }
}

async function archivesCollection() {
  return getCollection('revenue_archives')
}

/** The archive for an exact date, or null. */
async function findArchiveOn(companyId, date) {
  const collection = await archivesCollection()
  return collection.findOne({ companyId, archiveDate: startOfDay(date) })
}

/** The most recent archive at or before a date: how an "as of" view resolves. */
async function findArchiveOnOrBefore(companyId, date) {
  const collection = await archivesCollection()
  return collection.findOne({ companyId, archiveDate: { $lte: startOfDay(date) } }, { sort: { archiveDate: -1 } })
}

/** The most recent archive at or after a date. */
async function findArchiveSince(companyId, date) {
  const collection = await archivesCollection()
  return collection.findOne({ companyId, archiveDate: { $gte: startOfDay(date) } }, { sort: { archiveDate: -1 } })
}

/** Create or update today's archive with the given fields. */
async function upsertTodaysArchive(companyId, fields) {
  const collection = await archivesCollection()
  const archiveDate = todayDate()

  await collection.updateOne(
    { companyId, archiveDate },
    {
      $set: { ...fields, updatedAt: new Date() },
      $setOnInsert: { companyId, archiveDate, createdAt: new Date() },
    },
    { upsert: true },
  )

  return archiveDate
}

/** Normalize an archive into the response shape the frontend expects. */
function toRevenueResponse(archive, extra = {}) {
  return {
    months: archive.months || [],
    exceptions: archive.exceptions || emptyExceptions(),
    balances: archive.balances || emptyBalances(),
    lastUpdated: archive.updatedAt || archive.createdAt,
    ...extra,
  }
}

module.exports = {
  emptyExceptions,
  emptyBalances,
  archivesCollection,
  findArchiveOn,
  findArchiveOnOrBefore,
  findArchiveSince,
  upsertTodaysArchive,
  toRevenueResponse,
}
