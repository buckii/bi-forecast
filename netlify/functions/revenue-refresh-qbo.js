import { success, error, cors } from './utils/response.js'
import { getCurrentUser } from './utils/auth.js'
import RevenueCalculator from './services/revenue-calculator-optimized.js'
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
    const startTime = Date.now()
    const { company } = await getCurrentUser(event)
    
    
    const calculator = new RevenueCalculator(company._id)
    
    // Use optimized parallel data fetching
    const [months, balances] = await Promise.all([
      calculator.calculateMonthlyRevenue(14),
      calculator.getBalances()
    ])
    
    
    // Update the current archive with fresh data
    const archivesCollection = await getCollection('revenue_archives')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const dbStartTime = Date.now()
    await archivesCollection.updateOne(
      { 
        companyId: company._id,
        archiveDate: today
      },
      {
        $set: {
          months,
          balances,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    )
    
    
    return success({
      message: 'QuickBooks data refreshed successfully',
      lastUpdated: new Date().toISOString(),
      performanceStats: {
        totalTime: Date.now() - startTime,
        monthsCalculated: months.length,
        balanceAccounts: balances.assets?.length || 0
      }
    })
    
  } catch (err) {
    console.error('QBO refresh error:', err)
    return error(err.message || 'Failed to refresh QuickBooks data', 500)
  }
}