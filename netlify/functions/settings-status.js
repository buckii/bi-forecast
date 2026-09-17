const { createHandler } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')

exports.handler = createHandler({ errorMessage: 'Failed to get settings status' }, async ({ company }) => {
  const tokensCollection = await getCollection('oauth_tokens')

  const [pipedriveToken, qboToken] = await Promise.all([
    tokensCollection.findOne({ companyId: company._id, service: 'pipedrive' }),
    tokensCollection.findOne({ companyId: company._id, service: 'qbo' }),
  ])

  return {
    pipedrive: { connected: !!pipedriveToken, lastUpdated: pipedriveToken?.updatedAt || null },
    quickbooks: { connected: !!qboToken, lastUpdated: qboToken?.updatedAt || null },
  }
})
