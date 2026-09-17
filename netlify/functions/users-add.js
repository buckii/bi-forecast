const { createHandler, HttpError } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLES = ['viewer', 'admin']

exports.handler = createHandler(
  { methods: 'POST', role: 'admin', errorMessage: 'Failed to add user' },
  async ({ company, body }) => {
    const { email, role = 'viewer' } = body

    if (!email) throw new HttpError('Email is required', 400)
    if (!ROLES.includes(role)) throw new HttpError('Invalid role', 400)
    if (!EMAIL_PATTERN.test(email)) throw new HttpError('Invalid email format', 400)

    const usersCollection = await getCollection('users')

    const existingUser = await usersCollection.findOne({
      email: email.toLowerCase(),
      companyId: company._id,
    })

    if (existingUser) throw new HttpError('User already has access', 400)

    const result = await usersCollection.insertOne({
      email: email.toLowerCase(),
      companyId: company._id,
      role,
      createdAt: new Date(),
      lastLoginAt: null,
    })

    return { message: 'User access granted successfully', userId: result.insertedId }
  },
)
