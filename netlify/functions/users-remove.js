const { createHandler, HttpError } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')
const { ObjectId } = require('mongodb')

exports.handler = createHandler(
  { methods: 'POST', role: 'admin', errorMessage: 'Failed to remove user' },
  async ({ user, company, body }) => {
    const { userId } = body

    if (!userId) throw new HttpError('User ID is required', 400)
    if (userId === user._id.toString()) throw new HttpError('Cannot remove your own access', 400)

    const usersCollection = await getCollection('users')
    // Scoped to the caller's company so an id from another tenant cannot be removed.
    const scope = { _id: new ObjectId(userId), companyId: company._id }

    const result = await usersCollection.deleteOne(scope)
    if (result.deletedCount === 0) throw new HttpError('User not found', 404)

    return { message: 'User access removed successfully' }
  }
)
