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
    const { user, company } = await getCurrentUser(event)
    
    // Only admins can view the user list
    if (user.role !== 'admin') {
      return error('Insufficient permissions', 403)
    }

    const usersCollection = await getCollection('users')
    const users = await usersCollection.find({ companyId: company._id }).toArray()

    // Remove sensitive fields
    const sanitizedUsers = users.map(user => ({
      _id: user._id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    }))

    return success({
      users: sanitizedUsers
    })
    
  } catch (err) {
    console.error('Users list error:', err)
    return error(err.message || 'Failed to get users list', 500)
  }
}