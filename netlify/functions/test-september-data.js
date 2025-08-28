import { success, error, cors } from './utils/response.js'
import { getCurrentUser } from './utils/auth.js'
import QuickBooksService from './services/quickbooks.js'

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
    
    console.log('Testing September 2025 data for company:', company._id)
    
    const qbo = new QuickBooksService(company._id)
    
    // Test September 2025 specifically
    const startDate = '2025-09-01'
    const endDate = '2025-09-30'
    
    console.log(`Fetching data for September 2025: ${startDate} to ${endDate}`)
    
    // Test 1: Get invoices for September 2025
    let invoices = []
    try {
      invoices = await qbo.getInvoices(startDate, endDate)
      console.log(`✓ Found ${invoices.length} invoices for September 2025`)
      
      // Log detailed invoice line items
      const sampleInvoices = invoices.slice(0, 5).map(inv => ({
        docNumber: inv.DocNumber,
        date: inv.TxnDate,
        amount: inv.TotalAmt,
        customer: inv.CustomerRef?.name,
        lines: (inv.Line || []).map(line => {
          // Handle different line types
          const salesDetail = line.SalesItemLineDetail
          const discountDetail = line.DiscountLineDetail
          const subTotalDetail = line.SubTotalLineDetail
          
          return {
            lineNum: line.LineNum,
            description: line.Description,
            amount: line.Amount,
            detailType: line.DetailType,
            // Revenue account information (use income account from product mapping if available)
            revenueAccountRef: salesDetail?.IncomeAccountRef || salesDetail?.AccountRef,
            revenueAccountName: (salesDetail?.IncomeAccountRef || salesDetail?.AccountRef)?.name,
            revenueAccountNumber: (salesDetail?.IncomeAccountRef || salesDetail?.AccountRef)?.value,
            // Item information
            itemRef: salesDetail?.ItemRef,
            itemName: salesDetail?.ItemRef?.name,
            // Quantity and rate
            qty: salesDetail?.Qty,
            unitPrice: salesDetail?.UnitPrice,
            // Monthly indicators
            hasMonthly: (
              (salesDetail?.IncomeAccountRef || salesDetail?.AccountRef)?.name?.toLowerCase().includes('monthly') ||
              salesDetail?.ItemRef?.name?.toLowerCase().includes('monthly') ||
              line.Description?.toLowerCase().includes('monthly')
            ),
            isRevenueAccount: (salesDetail?.IncomeAccountRef || salesDetail?.AccountRef)?.name?.match(/^4\d{3}|revenue|income/i) ? true : false
          }
        }).filter(line => line.detailType === 'SalesItemLineDetail') // Only revenue lines
      }))
      console.log('Detailed invoice samples:', JSON.stringify(sampleInvoices, null, 2))
    } catch (err) {
      console.error('Error fetching invoices:', err.message)
    }
    
    // Test 2: Get journal entries for September 2025
    let journalEntries = []
    try {
      journalEntries = await qbo.getJournalEntries(startDate, endDate)
      console.log(`✓ Found ${journalEntries.length} journal entries for September 2025`)
      
      // Log detailed journal entry information - focus on revenue account lines
      const sampleEntries = journalEntries.slice(0, 5).map(entry => ({
        docNumber: entry.DocNumber,
        date: entry.TxnDate,
        totalAmount: entry.TotalAmt,
        privateNote: entry.PrivateNote,
        allLines: (entry.Line || []).map(line => ({
          lineNum: line.LineNum,
          description: line.Description,
          amount: line.Amount,
          accountRef: line.JournalEntryLineDetail?.AccountRef,
          accountName: line.JournalEntryLineDetail?.AccountRef?.name,
          accountNumber: line.JournalEntryLineDetail?.AccountRef?.value,
          postingType: line.JournalEntryLineDetail?.PostingType, // Credit or Debit
          isRevenueAccount: line.JournalEntryLineDetail?.AccountRef?.name?.match(/^4\d{3}|revenue|income/i) ? true : false,
          isLiabilityAccount: line.JournalEntryLineDetail?.AccountRef?.name?.match(/^2\d{3}|liability|payable/i) ? true : false
        })),
        // Filter to show only revenue account lines (these are the ones we want descriptions from)
        revenueLines: (entry.Line || []).filter(line => {
          const accountName = line.JournalEntryLineDetail?.AccountRef?.name
          return accountName?.match(/^4\d{3}|revenue|income/i)
        }).map(line => ({
          description: line.Description,
          amount: line.Amount,
          accountName: line.JournalEntryLineDetail?.AccountRef?.name,
          accountNumber: line.JournalEntryLineDetail?.AccountRef?.value,
          postingType: line.JournalEntryLineDetail?.PostingType,
          isUnearned: line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase().includes('unearned'),
          includedInTotal: line.JournalEntryLineDetail?.AccountRef?.name?.match(/^4\d{3}|revenue|income/i) && 
                         !line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase().includes('unearned')
        }))
      }))
      console.log('Detailed journal entries with revenue lines:', JSON.stringify(sampleEntries, null, 2))
    } catch (err) {
      console.error('Error fetching journal entries:', err.message)
    }
    
    // Test 3: Get delayed charges for September 2025
    let delayedCharges = []
    try {
      console.log('Fetching delayed charges for September 2025...')
      delayedCharges = await qbo.getDelayedCharges(startDate, endDate)
      console.log(`✓ Found ${delayedCharges.length} delayed charges for September 2025`)
      
      if (delayedCharges.length > 0) {
        console.log('Sample delayed charges:', JSON.stringify(delayedCharges.slice(0, 3).map(charge => ({
          docNumber: charge.DocNumber,
          date: charge.TxnDate,
          amount: charge.TotalAmt,
          customer: charge.CustomerRef?.name,
          lines: charge.Line?.length || 0
        })), null, 2))
      } else {
        console.log('No delayed charges found - checking date range and query parameters')
      }
    } catch (err) {
      console.error('Error fetching delayed charges:', err.message)
      console.error('Delayed charges error stack:', err.stack)
    }
    
    // Test 4: Get Pipedrive data for September 2025
    let pipedriveOpenDeals = []
    let pipedriveWonUnscheduled = []
    try {
      console.log('Fetching Pipedrive data for September 2025...')
      const pipedrive = new (await import('./services/pipedrive.js')).default(company._id)
      
      pipedriveOpenDeals = await pipedrive.getOpenDeals()
      pipedriveWonUnscheduled = await pipedrive.getWonUnscheduledDeals()
      
      console.log(`✓ Found ${pipedriveOpenDeals.length} open deals in Pipedrive`)
      console.log(`✓ Found ${pipedriveWonUnscheduled.length} won unscheduled deals in Pipedrive`)
      
      // Filter deals for September 2025
      const septemberOpenDeals = pipedriveOpenDeals.filter(deal => {
        if (!deal.expectedCloseDate) return false
        const closeDate = new Date(deal.expectedCloseDate)
        const dealMonth = closeDate.toISOString().substring(0, 7) // YYYY-MM format
        return dealMonth === '2025-09'
      })
      
      console.log(`Found ${septemberOpenDeals.length} open deals expected to close in September 2025:`)
      if (septemberOpenDeals.length > 0) {
        console.log('September open deals:', JSON.stringify(septemberOpenDeals.map(deal => ({
          id: deal.id,
          title: deal.title,
          expectedCloseDate: deal.expectedCloseDate,
          value: deal.value,
          weightedValue: deal.weightedValue,
          probability: deal.probability
        })), null, 2))
      }
      
    } catch (err) {
      console.error('Error fetching Pipedrive data:', err.message)
    }

    // Test 5: Calculate revenue components from the data
    const calculations = {
      invoicedTotal: invoices.reduce((sum, inv) => sum + (inv.TotalAmt || 0), 0),
      journalEntriesTotal: 0,
      monthlyRecurringTotal: 0,
      pipedriveWeightedSales: 0,
      pipedriveWonUnscheduled: 0
    }
    
    // Calculate journal entries revenue (excluding unearned revenue)
    for (const entry of journalEntries) {
      const lines = entry.Line || []
      for (const line of lines) {
        const accountRef = line.JournalEntryLineDetail?.AccountRef
        if (accountRef?.name?.match(/^4\d{3}|revenue|income/i) && 
            !accountRef?.name?.toLowerCase().includes('unearned')) {
          calculations.journalEntriesTotal += line.Amount || 0
        }
      }
    }
    
    // Calculate monthly recurring from invoices (note: this would only apply to future months in real calculation)
    for (const invoice of invoices) {
      const lines = invoice.Line || []
      for (const line of lines) {
        const accountRef = line.SalesItemLineDetail?.AccountRef
        const itemRef = line.SalesItemLineDetail?.ItemRef
        
        const hasMonthly = 
          accountRef?.name?.toLowerCase().includes('monthly') ||
          itemRef?.name?.toLowerCase().includes('monthly') ||
          line.Description?.toLowerCase().includes('monthly')
        
        if (hasMonthly) {
          calculations.monthlyRecurringTotal += line.Amount || 0
        }
      }
    }
    
    // Calculate Pipedrive weighted sales for September 2025
    const septemberDate = new Date('2025-09-01')
    const currentMonth = new Date()
    currentMonth.setDate(1) // Start of current month
    const isFutureMonth = septemberDate > currentMonth
    
    console.log(`September 2025 is ${isFutureMonth ? 'future' : 'current/past'} month`)
    
    for (const deal of pipedriveOpenDeals) {
      if (!deal.expectedCloseDate) continue
      
      const closeDate = new Date(deal.expectedCloseDate)
      const dealMonth = closeDate.toISOString().substring(0, 7)
      
      if (dealMonth === '2025-09') {
        const weightedValue = deal.weightedValue || (deal.value * (deal.probability || 0) / 100)
        calculations.pipedriveWeightedSales += weightedValue
      }
    }
    
    console.log('Revenue calculations for September 2025:', calculations)
    
    return success({
      testDate: 'September 2025',
      dateRange: { startDate, endDate },
      dataCounts: {
        invoices: invoices?.length || 0,
        journalEntries: journalEntries?.length || 0,
        delayedCharges: delayedCharges?.length || 0,
        pipedriveOpenDeals: pipedriveOpenDeals?.length || 0,
        pipedriveWonUnscheduled: pipedriveWonUnscheduled?.length || 0
      },
      calculations,
      sampleData: {
        firstInvoice: (invoices && invoices.length > 0) ? invoices[0] : null,
        firstJournalEntry: (journalEntries && journalEntries.length > 0) ? journalEntries[0] : null,
        firstDelayedCharge: (delayedCharges && delayedCharges.length > 0) ? delayedCharges[0] : null
      },
      samples: {
        invoicesWithLineItems: (invoices || []).slice(0, 3).map(inv => ({
          docNumber: inv?.DocNumber,
          date: inv?.TxnDate,
          amount: inv?.TotalAmt,
          customer: inv?.CustomerRef?.name,
          lines: (inv?.Line || []).filter(line => line.DetailType === 'SalesItemLineDetail').map(line => {
            const salesDetail = line.SalesItemLineDetail
            return {
              lineNum: line.LineNum,
              description: line.Description,
              amount: line.Amount,
              revenueAccountRef: salesDetail?.AccountRef,
              revenueAccountName: salesDetail?.AccountRef?.name,
              revenueAccountNumber: salesDetail?.AccountRef?.value,
              itemRef: salesDetail?.ItemRef,
              itemName: salesDetail?.ItemRef?.name,
              qty: salesDetail?.Qty,
              unitPrice: salesDetail?.UnitPrice,
              hasMonthly: (
                salesDetail?.AccountRef?.name?.toLowerCase().includes('monthly') ||
                salesDetail?.ItemRef?.name?.toLowerCase().includes('monthly') ||
                line.Description?.toLowerCase().includes('monthly')
              ),
              isRevenueAccount: salesDetail?.AccountRef?.name?.match(/^4\d{3}|revenue|income/i) ? true : false
            }
          })
        })),
        journalEntriesWithRevenueLines: (journalEntries || []).slice(0, 3).map(entry => ({
          docNumber: entry?.DocNumber,
          date: entry?.TxnDate,
          totalAmount: entry?.TotalAmt,
          privateNote: entry?.PrivateNote,
          revenueLines: (entry?.Line || []).filter(line => {
            const accountName = line.JournalEntryLineDetail?.AccountRef?.name
            return accountName?.match(/^4\d{3}|revenue|income/i)
          }).map(line => ({
            description: line.Description,
            amount: line.Amount,
            accountName: line.JournalEntryLineDetail?.AccountRef?.name,
            accountNumber: line.JournalEntryLineDetail?.AccountRef?.value,
            postingType: line.JournalEntryLineDetail?.PostingType,
            isUnearned: line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase().includes('unearned'),
            includedInTotal: line.JournalEntryLineDetail?.AccountRef?.name?.match(/^4\d{3}|revenue|income/i) && 
                           !line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase().includes('unearned')
          })),
          totalLines: entry?.Line?.length || 0,
          includedRevenueTotal: (entry?.Line || []).filter(line => {
            const accountName = line.JournalEntryLineDetail?.AccountRef?.name
            return accountName?.match(/^4\d{3}|revenue|income/i) && 
                   !accountName?.toLowerCase().includes('unearned')
          }).reduce((sum, line) => sum + (line.Amount || 0), 0),
          excludedUnearnedTotal: (entry?.Line || []).filter(line => {
            const accountName = line.JournalEntryLineDetail?.AccountRef?.name
            return accountName?.match(/^4\d{3}|revenue|income/i) && 
                   accountName?.toLowerCase().includes('unearned')
          }).reduce((sum, line) => sum + (line.Amount || 0), 0)
        })),
        delayedChargesWithDetails: (delayedCharges || []).slice(0, 3).map(charge => ({
          docNumber: charge?.DocNumber,
          date: charge?.TxnDate,
          amount: charge?.TotalAmt,
          customer: charge?.CustomerRef?.name,
          lines: charge?.Line?.length || 0,
          lineDetails: (charge?.Line || []).map(line => ({
            description: line.Description,
            amount: line.Amount
          }))
        })),
        pipedriveOpenDealsForSeptember: pipedriveOpenDeals.filter(deal => {
          if (!deal.expectedCloseDate) return false
          const closeDate = new Date(deal.expectedCloseDate)
          const dealMonth = closeDate.toISOString().substring(0, 7)
          return dealMonth === '2025-09'
        }).slice(0, 5).map(deal => ({
          id: deal.id,
          title: deal.title,
          expectedCloseDate: deal.expectedCloseDate,
          value: deal.value,
          weightedValue: deal.weightedValue,
          probability: deal.probability,
          orgName: deal.orgName,
          calculatedWeightedValue: deal.weightedValue || (deal.value * (deal.probability || 0) / 100)
        }))
      },
      insights: {
        hasNonInvoicedRevenue: calculations.journalEntriesTotal > 0 || calculations.monthlyRecurringTotal > 0,
        unearnedRevenueExcluded: true,
        potentialIssues: [
          (invoices?.length || 0) === 0 ? 'No invoices found for September 2025' : null,
          (journalEntries?.length || 0) === 0 ? 'No journal entries found for September 2025' : null,
          calculations.journalEntriesTotal === 0 && (journalEntries?.length || 0) > 0 ? 'Journal entries exist but none match revenue account patterns (excluding unearned revenue)' : null,
          calculations.monthlyRecurringTotal === 0 && (invoices?.length || 0) > 0 ? 'Invoices exist but none have "monthly" indicators' : null
        ].filter(Boolean)
      }
    })
    
  } catch (err) {
    console.error('September 2025 test error:', err)
    return error(err.message || 'Failed to test September 2025 data', 500)
  }
}