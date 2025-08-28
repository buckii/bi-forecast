import { success, error } from './utils/response.js'
import { getCollection } from './utils/database.js'
import RevenueCalculator from './services/revenue-calculator-optimized.js'

export async function handler(event, context) {
  // This function runs daily at 3am ET via Netlify scheduled functions
  console.log('Starting daily data archive process...')
  
  try {
    const companiesCollection = await getCollection('companies')
    const archivesCollection = await getCollection('revenue_archives')
    
    // Get all companies
    const companies = await companiesCollection.find({}).toArray()
    
    const results = []
    
    for (const company of companies) {
      try {
        console.log(`Processing company: ${company.name} (${company._id})`)
        
        const calculator = new RevenueCalculator(company._id)
        
        // Calculate current revenue data
        const months = await calculator.calculateMonthlyRevenue(14)
        const exceptions = await calculator.getExceptions()
        const balances = await calculator.getBalances()
        
        // Create today's archive
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const archiveDoc = {
          companyId: company._id,
          archiveDate: today,
          months,
          exceptions,
          balances,
          createdAt: new Date()
        }
        
        // Upsert (update or insert) today's archive
        await archivesCollection.updateOne(
          {
            companyId: company._id,
            archiveDate: today
          },
          { $set: archiveDoc },
          { upsert: true }
        )
        
        // Clean up old archives based on retention policy
        const retentionDays = company.settings?.archiveRetentionDays || 365
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
        
        const deleteResult = await archivesCollection.deleteMany({
          companyId: company._id,
          archiveDate: { $lt: cutoffDate }
        })
        
        results.push({
          companyId: company._id,
          companyName: company.name,
          success: true,
          monthsArchived: months.length,
          oldArchivesDeleted: deleteResult.deletedCount
        })
        
        console.log(`✓ Completed company ${company.name}: ${months.length} months archived, ${deleteResult.deletedCount} old archives deleted`)
        
      } catch (companyError) {
        console.error(`✗ Error processing company ${company.name}:`, companyError)
        results.push({
          companyId: company._id,
          companyName: company.name,
          success: false,
          error: companyError.message
        })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length
    
    console.log(`Archive process completed: ${successCount} successful, ${errorCount} errors`)
    
    return success({
      message: 'Daily archive process completed',
      summary: {
        totalCompanies: companies.length,
        successful: successCount,
        errors: errorCount
      },
      results
    })
    
  } catch (err) {
    console.error('Archive process error:', err)
    return error(err.message || 'Archive process failed', 500)
  }
}