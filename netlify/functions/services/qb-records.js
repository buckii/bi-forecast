// Filters on QuickBooks records that every revenue path applies the same way.

/** Records dated from startDate through endDate, 'YYYY-MM-DD' compared as text so no timezone moves them. */
function withinDates(records, startDate, endDate) {
  return (records || []).filter((record) => record.TxnDate >= startDate && record.TxnDate <= endDate)
}

/**
 * When an archive has no QuickBooks data (fallback mode), keep only records that already existed on
 * the as-of date. A record with no CreateTime is kept, since dropping it would understate revenue.
 */
function createdByAsOf(calculator, records, asOf) {
  if (!asOf || !calculator.isUsingFallback) return records

  const cutoff = new Date(`${asOf}T23:59:59.999Z`)
  return records.filter((record) => !record.MetaData?.CreateTime || new Date(record.MetaData.CreateTime) <= cutoff)
}

module.exports = { withinDates, createdByAsOf }
