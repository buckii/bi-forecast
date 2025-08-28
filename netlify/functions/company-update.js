import { success, error, cors } from './utils/response.js'
import { getCurrentUser } from './utils/auth.js'
import { getCollection } from './utils/database.js'

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
    
    const { name } = JSON.parse(event.body || '{}')
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return error('Company name is required', 400)
    }
    
    const companiesCollection = await getCollection('companies')
    
    // Update company information
    await companiesCollection.updateOne(
      { _id: company._id },
      { 
        $set: { 
          name: name.trim(),
          updatedAt: new Date()
        }
      }
    )
    
    return success({
      message: 'Company information updated successfully'
    })
    
  } catch (err) {
    console.error('Company update error:', err)
    return error(err.message || 'Failed to update company information', 500)
  }
}