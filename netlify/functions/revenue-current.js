const { success, error, cors } = require('./utils/response.js')
const { getCurrentUser } = require('./utils/auth.js')

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return cors()
  }

  if (event.httpMethod !== 'GET') {
    return error('Method not allowed', 405)
  }

  try {
    const { company } = await getCurrentUser(event)
    
    // Require the module directly
    const RevenueCalculator = require('./services/revenue-calculator-optimized.js')
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
    return error(err.message || 'Failed to get current revenue data', 500, {
      nodeVersion: process.version,
      platform: process.platform,
      moduleType: typeof module !== 'undefined' ? 'CommonJS' : 'ES Module',
      errorStack: err.stack
    })
  }
}