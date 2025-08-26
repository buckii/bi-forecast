import { success, error, cors } from './utils/response.js'
import { getCurrentUser } from './utils/auth.js'
import { getCollection } from './utils/database.js'
import { encrypt } from './utils/encryption.js'
import fetch from 'node-fetch'

export async function handler(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    
    const { apiKey } = JSON.parse(event.body || '{}')
    
    if (!apiKey) {
      return error('API key is required', 400)
    }
    
    // Test the API key by making a simple request
    try {
      const testResponse = await fetch(`https://api.pipedrive.com/v1/users/me?api_token=${apiKey}`)
      
      if (!testResponse.ok) {
        throw new Error('Invalid API key')
      }
      
      const userData = await testResponse.json()
      
      if (!userData.success) {
        throw new Error('Invalid API key')
      }
      
    } catch (testError) {
      return error('Invalid Pipedrive API key. Please check your key and try again.', 400)
    }
    
    // Store encrypted API key
    const tokensCollection = await getCollection('oauth_tokens')
    
    const tokenDoc = {
      companyId: company._id,
      service: 'pipedrive',
      accessToken: encrypt(apiKey),
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await tokensCollection.updateOne(
      { companyId: company._id, service: 'pipedrive' },
      { $set: tokenDoc },
      { upsert: true }
    )
    
    return success({
      message: 'Pipedrive API key saved successfully',
      connected: true
    })
    
  } catch (err) {
    console.error('Pipedrive connect error:', err)
    return error(err.message || 'Failed to connect Pipedrive', 500)
  }
}