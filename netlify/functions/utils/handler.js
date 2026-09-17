// Handles CORS preflight, method and role checks, authentication, body parsing, and error mapping:
//
//   exports.handler = createHandler({ methods: 'POST', role: 'admin' }, async ({ company, body }) => ...)
//
// The inner function returns the payload to wrap in success(), or a full response object to pass
// through. Throw HttpError for a controlled status; anything else becomes a 500.

const { success, error, cors } = require('./response.js')
const { getCurrentUser } = require('./auth.js')

class HttpError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.details = details
  }
}

// These mean "not authenticated", so they map to 401 and the client re-authenticates.
const AUTH_FAILURES = [
  'No valid authorization token provided',
  'Invalid token',
  'User not found',
  'User has no associated company',
  'Company not found'
]

function statusForError(err) {
  if (err instanceof HttpError) return err.statusCode
  if (Number.isInteger(err.statusCode)) return err.statusCode
  if (AUTH_FAILURES.includes(err.message)) return 401
  return 500
}

function createHandler(options, fn) {
  if (typeof options === 'function') {
    fn = options
    options = {}
  }

  const {
    methods = ['GET'],
    auth = true,
    role = null,
    parseBody = true,
    errorMessage = 'Request failed',
    authenticate = getCurrentUser
  } = options

  const allowed = (Array.isArray(methods) ? methods : [methods]).map(m => m.toUpperCase())

  return async function handler(event, context) {
    const origin = event.headers?.origin || event.headers?.Origin

    if (event.httpMethod === 'OPTIONS') return cors(origin)

    if (!allowed.includes(event.httpMethod)) {
      return error('Method not allowed', 405, null, origin)
    }

    try {
      let user = null
      let company = null

      if (auth) {
        ({ user, company } = await authenticate(event))

        if (role && user.role !== role) {
          throw new HttpError('Insufficient permissions', 403)
        }
      }

      let body = {}
      if (parseBody && event.body && event.httpMethod !== 'GET') {
        try {
          body = JSON.parse(event.body)
        } catch {
          throw new HttpError('Invalid JSON body', 400)
        }
      }

      const result = await fn({
        event,
        context,
        user,
        company,
        body,
        query: event.queryStringParameters || {},
        origin
      })

      // A redirect or non-JSON response the handler built itself.
      if (result && typeof result === 'object' && 'statusCode' in result) return result

      return success(result, 200, origin)
    } catch (err) {
      const statusCode = statusForError(err)

      if (statusCode >= 500) console.error(`${errorMessage}:`, err)

      return error(
        err instanceof HttpError ? err.message : err.message || errorMessage,
        statusCode,
        err instanceof HttpError ? err.details : err.stack,
        origin
      )
    }
  }
}

module.exports = { createHandler, HttpError }
