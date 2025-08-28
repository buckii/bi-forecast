import { success, error, cors } from './utils/response.js'
import { getCurrentUser } from './utils/auth.js'

export async function handler(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    await getCurrentUser(event) // Verify user is authenticated
    
    const clientId = process.env.QBO_CLIENT_ID
    const redirectUri = process.env.QBO_REDIRECT_URI || `${process.env.URL}/.netlify/functions/qbo-oauth-callback`
    const scope = 'com.intuit.quickbooks.accounting'
    const state = Math.random().toString(36).substring(2, 15) // Simple state for CSRF protection
    
    
    if (!clientId) {
      return error('QuickBooks OAuth not configured', 500)
    }
    
    // QuickBooks OAuth2 URL - note: no access_type parameter for QuickBooks
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `state=${state}`
    
    return success({
      authUrl,
      state
    })
    
  } catch (err) {
    console.error('QBO OAuth start error:', err)
    return error(err.message || 'Failed to start QuickBooks OAuth flow', 500)
  }
}