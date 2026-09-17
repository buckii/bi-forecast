const { createHandler } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')

exports.handler = createHandler({ role: 'admin', errorMessage: 'Failed to get users list' }, async ({ company }) => {
  const usersCollection = await getCollection('users')
  const users = await usersCollection.find({ companyId: company._id }).toArray()

  return {
    users: users.map((user) => ({
      _id: user._id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    })),
  }
})
