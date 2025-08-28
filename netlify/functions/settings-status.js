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
    
    const tokensCollection = await getCollection('oauth_tokens')
    
    // Check Pipedrive connection
    const pipedriveToken = await tokensCollection.findOne({
      companyId: company._id,
      service: 'pipedrive'
    })
    
    // Check QuickBooks connection
    const qboToken = await tokensCollection.findOne({
      companyId: company._id,
      service: 'qbo'
    })
    
    return success({
      pipedrive: {
        connected: !!pipedriveToken,
        lastUpdated: pipedriveToken?.updatedAt || null
      },
      quickbooks: {
        connected: !!qboToken,
        lastUpdated: qboToken?.updatedAt || null
      }
    })
    
  } catch (err) {
    console.error('Settings status error:', err)
    return error(err.message || 'Failed to get settings status', 500)
  }
}