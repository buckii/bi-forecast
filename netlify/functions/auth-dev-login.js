const { generateToken, getCurrentUser } = require('./utils/auth.js')
const { getCollection } = require('./utils/database.js')

/**
 * Development-only login endpoint that bypasses Google OAuth
 * ONLY works when BYPASS_AUTH_LOCALHOST=true and on localhost
 */
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    // Security check - only allow on localhost with bypass enabled
    const bypassAuth = process.env.BYPASS_AUTH_LOCALHOST === 'true'
    const isLocalhost = event.headers.host?.includes('localhost') || event.headers.host?.includes('127.0.0.1')

    if (!bypassAuth || !isLocalhost) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: 'Dev login is only available on localhost with BYPASS_AUTH_LOCALHOST=true'
        })
      }
    }

    // Get first user and company from database
    const usersCollection = await getCollection('users')
    const companiesCollection = await getCollection('companies')

    const user = await usersCollection.findOne({})
    const company = await companiesCollection.findOne({})

    if (!user || !company) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'No user or company found in database for dev login'
        })
      }
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      email: user.email,
      companyId: company._id
    })

    // Return same structure as auth-google endpoint
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          role: user.role
        },
        company: {
          id: company._id,
          name: company.name,
          domain: company.domain
        }
      })
    }
  } catch (error) {
    console.error('Dev login error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Dev login failed',
        message: error.message
      })
    }
  }
}
