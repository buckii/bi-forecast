import fetch from 'node-fetch'
import { success, error } from './utils/response.js'
import { getCollection } from './utils/database.js'
import { encrypt } from './utils/encryption.js'

export async function handler(event, context) {
  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { code, realmId, state } = event.queryStringParameters || {}
    
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
    
    // For now, we'll associate with the first company found
    // In production, you'd want to properly associate with the correct company
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
    const successUrl = process.env.URL || 'http://localhost:3000'
    
    return {
      statusCode: 302,
      headers: {
        Location: `${successUrl}/settings?qbo=connected`
      }
    }
    
  } catch (err) {
    console.error('QBO OAuth callback error:', err)
    
    // Redirect to error page
    const errorUrl = process.env.URL || 'http://localhost:3000'
    
    return {
      statusCode: 302,
      headers: {
        Location: `${errorUrl}/settings?qbo=error&message=${encodeURIComponent(err.message)}`
      }
    }
  }
}