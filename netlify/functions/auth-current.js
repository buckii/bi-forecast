const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { user, company } = await getCurrentUser(event)
    
    return success({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      company: {
        id: company._id,
        name: company.name,
        domain: company.domain,
        settings: company.settings || {}
      }
    })
    
  } catch (err) {
    console.error('Get current user error:', err)
    return error(err.message || 'Failed to get current user', 401)
  }
}