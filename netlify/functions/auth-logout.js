const { success, cors } = require('./utils/response.js')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  // Since we're using stateless JWT tokens, logout is handled client-side
  // by removing the token from localStorage
  return success({ message: 'Logged out successfully' })
}