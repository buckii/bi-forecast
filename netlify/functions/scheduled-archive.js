const { success, error } = require('./utils/response.js')
const { getCollection } = require('./utils/database.js')
const RevenueCalculator = require('./services/revenue-calculator.js')
const SlackService = require('./services/slack.js')
const { startOfMonth, endOfMonth, addMonths, format } = require('date-fns')

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
        // This caches QBO data in calculator instance
        const revenueResult = await calculator.calculateMonthlyRevenue(18, -6)
        const months = revenueResult.months || revenueResult // Handle both old and new return format
        const dataSourceErrors = revenueResult.dataSourceErrors || []

        // Fetch exceptions and balances, passing months data to getBalances
        // getBalances will use the cached QBO data from calculateMonthlyRevenue
        const [exceptions, balances] = await Promise.all([
          calculator.getExceptions(),
          calculator.getBalances(months)
        ])

        // Archive QuickBooks data (invoices, journal entries, delayed charges)
        const qboData = await archiveQuickBooksData(calculator, -6, 18)

        // Archive Pipedrive data (open deals, won unscheduled)
        const pipedriveData = await archivePipedriveData(calculator)
        
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
          quickbooks: qboData,
          pipedrive: pipedriveData,
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

/**
 * Archive QuickBooks data including invoices, journal entries, and delayed charges
 * @param {RevenueCalculator} calculator - Revenue calculator instance
 * @param {number} startOffset - Months offset from current month (negative for past)
 * @param {number} monthsCount - Number of months to archive
 * @returns {Object} Archived QuickBooks data
 */
async function archiveQuickBooksData(calculator, startOffset, monthsCount) {
  const currentDate = new Date()
  const startMonth = addMonths(startOfMonth(currentDate), startOffset)
  const endMonth = addMonths(startOfMonth(currentDate), startOffset + monthsCount - 1)
  const startDate = format(startMonth, 'yyyy-MM-dd')
  const endDate = format(endOfMonth(endMonth), 'yyyy-MM-dd')

  console.log(`[Archive QB] Fetching data from ${startDate} to ${endDate}`)

  try {
    const [invoices, journalEntries, delayedCharges] = await Promise.all([
      calculator.qbo.getInvoices(startDate, endDate),
      calculator.qbo.getJournalEntries(startDate, endDate),
      calculator.qbo.getDelayedCharges(startDate, endDate)
    ])

    // Separate open and all invoices
    const openInvoices = invoices.filter(inv => parseFloat(inv.Balance || 0) > 0)

    console.log(`[Archive QB] ✓ Captured ${invoices.length} invoices (${openInvoices.length} open), ${journalEntries.length} journal entries, ${delayedCharges.length} delayed charges`)

    return {
      invoices: {
        open: openInvoices,
        all: invoices,
        lastSync: new Date()
      },
      journalEntries: {
        all: journalEntries,
        lastSync: new Date()
      },
      delayedCharges: {
        active: delayedCharges,
        lastSync: new Date()
      }
    }
  } catch (error) {
    console.error('[Archive QB] Error archiving QuickBooks data:', error)
    return {
      invoices: { open: [], all: [], error: error.message, lastSync: new Date() },
      journalEntries: { all: [], error: error.message, lastSync: new Date() },
      delayedCharges: { active: [], error: error.message, lastSync: new Date() }
    }
  }
}

/**
 * Archive Pipedrive data including open deals and won unscheduled deals
 * @param {RevenueCalculator} calculator - Revenue calculator instance
 * @returns {Object} Archived Pipedrive data
 */
async function archivePipedriveData(calculator) {
  console.log('[Archive PD] Fetching Pipedrive data...')

  try {
    const [openDeals, wonUnscheduled] = await Promise.all([
      calculator.pipedrive.getOpenDeals(),
      calculator.pipedrive.getWonUnscheduledDeals()
    ])

    console.log(`[Archive PD] ✓ Captured ${openDeals.length} open deals, ${wonUnscheduled.length} won unscheduled deals`)

    return {
      openDeals: {
        deals: openDeals,
        lastSync: new Date()
      },
      wonUnscheduled: {
        deals: wonUnscheduled,
        lastSync: new Date()
      }
    }
  } catch (error) {
    console.error('[Archive PD] Error archiving Pipedrive data:', error)
    return {
      openDeals: { deals: [], error: error.message, lastSync: new Date() },
      wonUnscheduled: { deals: [], error: error.message, lastSync: new Date() }
    }
  }
}