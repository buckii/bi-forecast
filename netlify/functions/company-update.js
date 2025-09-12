const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')
const { getCollection } = require('./utils/database.js')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'POST') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    
    const requestBody = JSON.parse(event.body || '{}')
    const { name, targetNetMargin, monthlyExpensesOverride } = requestBody
    
    const companiesCollection = await getCollection('companies')
    const updateData = { updatedAt: new Date() }
    
    // Handle company name update
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return error('Company name is required', 400)
      }
      updateData.name = name.trim()
    }
    
    // Handle financial settings updates
    if (targetNetMargin !== undefined || monthlyExpensesOverride !== undefined) {
      // Initialize settings object if it doesn't exist
      const currentSettings = company.settings || {}
      
      if (targetNetMargin !== undefined) {
        if (typeof targetNetMargin !== 'number' || targetNetMargin < 1 || targetNetMargin > 50) {
          return error('Target net margin must be a number between 1 and 50', 400)
        }
        currentSettings.targetNetMargin = targetNetMargin
      }
      
      if (monthlyExpensesOverride !== undefined) {
        if (monthlyExpensesOverride !== null && (typeof monthlyExpensesOverride !== 'number' || monthlyExpensesOverride < 0)) {
          return error('Monthly expenses override must be a positive number or null', 400)
        }
        currentSettings.monthlyExpensesOverride = monthlyExpensesOverride
      }
      
      updateData.settings = currentSettings
    }
    
    // Update company information
    await companiesCollection.updateOne(
      { _id: company._id },
      { $set: updateData }
    )
    
    return success({
      message: 'Company information updated successfully'
    })
    
  } catch (err) {
    console.error('Company update error:', err)
    return error(err.message || 'Failed to update company information', 500)
  }
}