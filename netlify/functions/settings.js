const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const { getCollection } = require('./utils/database.js')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    const body = JSON.parse(event.body)

    if (body.clientAliases !== undefined) {
      const clientAliasesCollection = await getCollection('client_aliases')

      // Delete existing aliases for this company
      await clientAliasesCollection.deleteMany({ companyId: company._id })

      // Insert new aliases if provided
      if (body.clientAliases.length > 0) {
        const aliasDocuments = body.clientAliases.map(client => ({
          companyId: company._id,
          primaryName: client.primaryName,
          aliases: client.aliases,
          createdAt: new Date(),
          updatedAt: new Date()
        }))

        await clientAliasesCollection.insertMany(aliasDocuments)
      }

      return success({
        message: 'Client aliases updated successfully'
      })
    }

    return error('No settings provided to update', 400)

  } catch (err) {
    console.error('Settings update error:', err)
    return error(err.message || 'Failed to update settings', 500)
  }
}
