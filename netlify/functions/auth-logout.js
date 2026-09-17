const { createHandler } = require('./utils/handler.js')

// Tokens are stateless JWTs; logout is the client discarding its token.
exports.handler = createHandler({ methods: ['GET', 'POST'], auth: false }, async () => ({
  message: 'Logged out successfully',
}))
