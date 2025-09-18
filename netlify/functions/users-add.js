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
    const { user, company } = await getCurrentUser(event)
    
    // Only admins can add users
    if (user.role !== 'admin') {
      return error('Insufficient permissions', 403)
    }

    const body = JSON.parse(event.body)
    const { email, role = 'viewer' } = body

    if (!email) {
      return error('Email is required', 400)
    }

    if (!['viewer', 'admin'].includes(role)) {
      return error('Invalid role', 400)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return error('Invalid email format', 400)
    }

    const usersCollection = await getCollection('users')
    
    // Check if user already exists
    const existingUser = await usersCollection.findOne({ 
      email: email.toLowerCase(),
      companyId: company._id 
    })

    if (existingUser) {
      return error('User already has access', 400)
    }

    // Create new user
    const newUser = {
      email: email.toLowerCase(),
      companyId: company._id,
      role: role,
      createdAt: new Date(),
      lastLoginAt: null
    }

    const result = await usersCollection.insertOne(newUser)

    return success({
      message: 'User access granted successfully',
      userId: result.insertedId
    })
    
  } catch (err) {
    console.error('Add user error:', err)
    return error(err.message || 'Failed to add user', 500)
  }
}