// Development-only login. Works only on localhost with BYPASS_AUTH_LOCALHOST=true.
const { createHandler, HttpError } = require('./utils/handler.js')
const { generateToken } = require('./utils/auth.js')
const { getCollection } = require('./utils/database.js')

function isDevLoginAllowed(event) {
  const host = event.headers?.host || ''
  return process.env.BYPASS_AUTH_LOCALHOST === 'true' && (host.includes('localhost') || host.includes('127.0.0.1'))
}

exports.handler = createHandler(
  { methods: ['GET', 'POST'], auth: false, errorMessage: 'Dev login failed' },
  async ({ event }) => {
    if (!isDevLoginAllowed(event)) {
      throw new HttpError('Dev login is only available on localhost with BYPASS_AUTH_LOCALHOST=true', 403)
    }

    const [usersCollection, companiesCollection] = await Promise.all([
      getCollection('users'),
      getCollection('companies'),
    ])

    const [user, company] = await Promise.all([usersCollection.findOne({}), companiesCollection.findOne({})])

    if (!user || !company) {
      throw new HttpError('No user or company found in database for dev login', 500)
    }

    return {
      token: generateToken({ userId: user._id, email: user.email, companyId: company._id }),
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
      },
      company: { id: company._id, name: company.name, domain: company.domain },
    }
  },
)
