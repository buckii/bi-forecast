const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const { getCollection } = require('./utils/database.js')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    
    const { date } = event.queryStringParameters || {}

    if (!date) {
      return error('Date parameter is required', 400)
    }

    // Parse date string (YYYY-MM-DD or ISO) and create a UTC midnight date
    let archiveDate
    if (date.includes('T')) {
      // ISO string with time - parse and set to midnight UTC
      archiveDate = new Date(date)
      archiveDate.setUTCHours(0, 0, 0, 0)
    } else {
      // Date-only string (YYYY-MM-DD) - create UTC date directly
      // This avoids timezone conversion issues
      const [year, month, day] = date.split('-').map(Number)
      archiveDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    }
    
    // Find the closest archive on or before the requested date
    const archivesCollection = await getCollection('revenue_archives')
    
    const archive = await archivesCollection.findOne(
      {
        companyId: company._id,
        archiveDate: { $lte: archiveDate }
      },
      { sort: { archiveDate: -1 } }
    )
    
    if (!archive) {
      return error('No historical data found for the requested date', 404)
    }
    
    return success({
      months: archive.months || [],
      exceptions: archive.exceptions || { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
      balances: archive.balances || { assets: [], receivables: null },
      archiveDate: archive.archiveDate,
      lastUpdated: archive.createdAt
    })
    
  } catch (err) {
    console.error('Revenue historical error:', err)
    return error(err.message || 'Failed to get historical revenue data', 500)
  }
}