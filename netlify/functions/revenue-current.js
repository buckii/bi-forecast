import { success, error, cors } from './utils/response.js'
import { getCurrentUser } from './utils/auth.js'
import RevenueCalculator from './services/revenue-calculator.js'

export async function handler(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    
    const calculator = new RevenueCalculator(company._id)
    
    // Get revenue data for 24 months (12 historical + 12 future)
    const months = await calculator.calculateMonthlyRevenue(24)
    
    // Get exceptions
    const exceptions = await calculator.getExceptions()
    
    // Get account balances
    const balances = await calculator.getBalances()
    
    return success({
      months,
      exceptions,
      balances,
      lastUpdated: new Date().toISOString()
    })
    
  } catch (err) {
    console.error('Revenue current error:', err)
    return error(err.message || 'Failed to get current revenue data', 500)
  }
}