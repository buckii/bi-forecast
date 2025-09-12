const { success, error } = require('./utils/response.js')
const { getCollection } = require('./utils/database.js')
const RevenueCalculator = require('./services/revenue-calculator.js')
const SlackService = require('./services/slack.js')

exports.handler = async function(event, context) {
  // This function runs daily at 3am ET via Netlify scheduled functions
  
  try {
    const companiesCollection = await getCollection('companies')
    const archivesCollection = await getCollection('revenue_archives')
    
    // Get all companies
    const companies = await companiesCollection.find({}).toArray()
    
    const results = []
    
    for (const company of companies) {
      try {
        
        const calculator = new RevenueCalculator(company._id)
        
        // Calculate current revenue data (18 months: 6 months ago to 12 months from now)
        const revenueResult = await calculator.calculateMonthlyRevenue(18, -6)
        const months = revenueResult.months || revenueResult // Handle both old and new return format
        const dataSourceErrors = revenueResult.dataSourceErrors || []
        
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
          dataSourceErrors,
          createdAt: new Date()
        }
        
        // Check if there were any data source errors
        if (dataSourceErrors.length > 0) {
          console.warn(`Data source errors for company ${company.name}:`, dataSourceErrors)
          
          // Send Slack notification for data source failures
          try {
            const slack = new SlackService()
            const failedSources = dataSourceErrors.map(err => `${err.provider} ${err.source}`).join(', ')
            await slack.sendNightlyJobFailure(company.name, failedSources, dataSourceErrors)
          } catch (slackError) {
            console.error('Failed to send Slack notification:', slackError.message)
          }
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
          monthsArchived: Array.isArray(months) ? months.length : 0,
          oldArchivesDeleted: deleteResult.deletedCount,
          dataSourceErrors: dataSourceErrors.length
        })
        
        
      } catch (companyError) {
        console.error(`✗ Error processing company ${company.name}:`, companyError)
        
        // Send Slack notification for complete failure
        try {
          const slack = new SlackService()
          await slack.sendNightlyJobFailure(company.name, 'Complete system failure', [{ error: companyError.message }])
        } catch (slackError) {
          console.error('Failed to send Slack notification:', slackError.message)
        }
        
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