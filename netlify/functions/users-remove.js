const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const { getCollection } = require('./utils/database.js')
const { ObjectId } = require('mongodb')

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
    
    // Only admins can remove users
    if (user.role !== 'admin') {
      return error('Insufficient permissions', 403)
    }

    const body = JSON.parse(event.body)
    const { userId } = body

    if (!userId) {
      return error('User ID is required', 400)
    }

    // Prevent users from removing themselves
    if (userId === user._id.toString()) {
      return error('Cannot remove your own access', 400)
    }

    const usersCollection = await getCollection('users')
    
    // Check if user exists and belongs to the same company
    const targetUser = await usersCollection.findOne({ 
      _id: new ObjectId(userId),
      companyId: company._id 
    })

    if (!targetUser) {
      return error('User not found', 404)
    }

    // Remove the user
    const result = await usersCollection.deleteOne({ 
      _id: new ObjectId(userId),
      companyId: company._id 
    })

    if (result.deletedCount === 0) {
      return error('Failed to remove user', 500)
    }

    return success({
      message: 'User access removed successfully'
    })
    
  } catch (err) {
    console.error('Remove user error:', err)
    return error(err.message || 'Failed to remove user', 500)
  }
}