// Using built-in fetch API
const { success, error } = require('./utils/response.js')
const { getCollection } = require('./utils/database.js')
const { encrypt } = require('./utils/encryption.js')

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { code, realmId, state, error: oauthError, error_description } = event.queryStringParameters || {}
    
    // Check for OAuth errors first
    if (oauthError) {
      throw new Error(`QuickBooks OAuth error: ${oauthError} - ${error_description || 'Unknown error'}`)
    }
    
    if (!code || !realmId) {
      return error('Missing required OAuth parameters', 400)
    }
    
    // Exchange authorization code for access token
    const clientId = process.env.QBO_CLIENT_ID
    const clientSecret = process.env.QBO_CLIENT_SECRET
    const redirectUri = process.env.QBO_REDIRECT_URI || `${process.env.URL}/.netlify/functions/qbo-oauth-callback`
    
    if (!clientId || !clientSecret) {
      return error('QuickBooks OAuth not configured', 500)
    }
    
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${errorText}`)
    }
    
    const tokenData = await tokenResponse.json()
    
    // Store encrypted tokens in database
    const tokensCollection = await getCollection('oauth_tokens')
    
    // Get the company ID from the state parameter or use first company as fallback
    // In a production app, you'd pass the user's company ID in the state parameter
    const companiesCollection = await getCollection('companies')
    const company = await companiesCollection.findOne({})
    
    if (!company) {
      return error('No company found to associate QuickBooks account', 400)
    }
    
    const tokenDoc = {
      companyId: company._id,
      service: 'qbo',
      accessToken: encrypt(tokenData.access_token),
      refreshToken: encrypt(tokenData.refresh_token),
      realm: realmId,
      expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await tokensCollection.updateOne(
      { companyId: company._id, service: 'qbo' },
      { $set: tokenDoc },
      { upsert: true }
    )
    
    // Redirect to success page
    if (!process.env.URL) {
      return error('URL environment variable not configured', 500)
    }
    
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.URL}/settings?qbo=connected`
      }
    }
    
  } catch (err) {
    
    // Redirect to error page
    if (!process.env.URL) {
      return error('URL environment variable not configured', 500)
    }
    
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.URL}/settings?qbo=error&message=${encodeURIComponent(err.message)}`
      }
    }
  }
}