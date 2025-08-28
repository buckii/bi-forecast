import { success, error, cors } from './utils/response.js'
import { verifyGoogleToken, getOrCreateUser, generateToken } from './utils/auth.js'
import { validateFunctionEnv } from './utils/env-validation.js'

export async function handler(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    // Validate required environment variables
    validateFunctionEnv(['GOOGLE_CLIENT_ID', 'JWT_SECRET', 'MONGODB_URI'])
    
    const { token } = JSON.parse(event.body || '{}')
    
    if (!token) {
      return error('Google token is required', 400)
    }

    // Verify Google token
    const googleUserData = await verifyGoogleToken(token)
    
    // Get or create user and company
    const { user, company } = await getOrCreateUser(googleUserData)
    
    // Generate JWT token
    const jwtToken = generateToken({
      userId: user._id,
      email: user.email,
      companyId: company._id
    })
    
    return success({
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      company: {
        id: company._id,
        name: company.name,
        domain: company.domain
      }
    })
    
  } catch (err) {
    return error(err.message || 'Authentication failed', 401)
  }
}