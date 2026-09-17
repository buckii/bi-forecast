const { createHandler } = require('./utils/handler.js')

exports.handler = createHandler({ errorMessage: 'Failed to get current user' }, async ({ user, company }) => ({
  user: {
    id: user._id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
  },
  company: {
    id: company._id,
    name: company.name,
    domain: company.domain,
    settings: company.settings || {},
  },
}))
