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

    const clientAliasesCollection = await getCollection('client_aliases')

    const aliases = await clientAliasesCollection
      .find({ companyId: company._id })
      .sort({ primaryName: 1 })
      .toArray()

    // Transform to frontend format
    const clientAliases = aliases.map(alias => ({
      primaryName: alias.primaryName,
      aliases: alias.aliases
    }))

    return success({
      clientAliases
    })

  } catch (err) {
    console.error('Client aliases fetch error:', err)
    return error(err.message || 'Failed to fetch client aliases', 500)
  }
}
