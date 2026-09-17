const { createHandler, HttpError } = require('./utils/handler.js')
const { verifyGoogleToken, getOrCreateUser, generateToken } = require('./utils/auth.js')
const { validateFunctionEnv } = require('./utils/env-validation.js')

exports.handler = createHandler(
  { methods: 'POST', auth: false, errorMessage: 'Authentication failed' },
  async ({ body }) => {
    validateFunctionEnv(['GOOGLE_CLIENT_ID', 'JWT_SECRET', 'MONGODB_URI'])

    if (!body.token) throw new HttpError('Google token is required', 400)

    const googleUserData = await verifyGoogleToken(body.token)
    const { user, company } = await getOrCreateUser(googleUserData)

    return {
      token: generateToken({ userId: user._id, email: user.email, companyId: company._id }),
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role
      },
      company: { id: company._id, name: company.name, domain: company.domain }
    }
  }
)
