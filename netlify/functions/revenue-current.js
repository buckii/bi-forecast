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
    const { company } = await getCurrentUser(event)
    
    // Dynamic import to handle ES module compatibility issues
    const { default: RevenueCalculator } = await import('./services/revenue-calculator-optimized.js')
    const calculator = new RevenueCalculator(company._id)
    
    // Get revenue data for 14 months (3 previous + current + 10 future)
    const months = await calculator.calculateMonthlyRevenue(14)
    
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