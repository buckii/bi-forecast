<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
      
      <!-- Company Information -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Company Information</h2>
          <button 
            @click="editingCompany = !editingCompany"
            class="btn-secondary text-sm"
          >
            {{ editingCompany ? 'Cancel' : 'Edit' }}
          </button>
        </div>
        
        <div v-if="!editingCompany" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Company Name</label>
            <p class="mt-1 text-sm text-gray-900">{{ company?.name || 'N/A' }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Domain</label>
            <p class="mt-1 text-sm text-gray-900">{{ company?.domain || 'N/A' }}</p>
          </div>
        </div>
        
        <div v-else class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Company Name</label>
            <input
              type="text"
              v-model="editableCompanyName"
              class="input mt-1"
              placeholder="Enter company name"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Domain</label>
            <p class="mt-1 text-sm text-gray-500">{{ company?.domain || 'N/A' }}</p>
            <p class="text-xs text-gray-400">Domain cannot be changed as it's linked to your Google account</p>
          </div>
          <div class="flex justify-end space-x-3">
            <button @click="editingCompany = false" class="btn-secondary">
              Cancel
            </button>
            <button @click="saveCompanyInfo" class="btn-primary">
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <!-- Appearance Settings -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Appearance</h2>
        <label class="flex items-center cursor-pointer">
          <input
            type="checkbox"
            v-model="isDarkMode"
            @change="toggleDarkMode"
            class="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-500 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
          />
          <span class="ml-2 text-gray-700 dark:text-gray-300">Dark mode</span>
        </label>
      </div>
      
      <!-- API Connections -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">API Connections</h2>
        <div class="space-y-4">
          <!-- QuickBooks Online -->
          <div class="flex items-center justify-between p-4 border dark:border-gray-600 rounded-lg">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-gray-100">QuickBooks Online</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Connect to sync invoices, journal entries, and delayed charges</p>
            </div>
            <div class="flex items-center space-x-3">
              <span class="text-sm" :class="qboConnected ? 'text-green-600' : 'text-gray-500'">
                {{ qboConnected ? 'Connected' : 'Not Connected' }}
              </span>
              <button 
                @click="qboConnected ? disconnectQBO() : connectQBO()"
                :class="qboConnected ? 'btn-secondary' : 'btn-primary'"
              >
                {{ qboConnected ? 'Disconnect' : 'Connect' }}
              </button>
            </div>
          </div>
          
          <!-- Pipedrive -->
          <div class="flex items-center justify-between p-4 border dark:border-gray-600 rounded-lg">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-gray-100">Pipedrive</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Connect to sync deals and pipeline data</p>
            </div>
            <div class="flex items-center space-x-3">
              <span class="text-sm" :class="pipedriveConnected ? 'text-green-600' : 'text-gray-500'">
                {{ pipedriveConnected ? 'Connected' : 'Not Connected' }}
              </span>
              <button 
                @click="pipedriveConnected ? showPipedriveModal = false : showPipedriveModal = true"
                :class="pipedriveConnected ? 'btn-secondary' : 'btn-primary'"
              >
                {{ pipedriveConnected ? 'Update' : 'Connect' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Data Management -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Data Management</h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-gray-100">Archive Retention</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Number of days to keep historical data</p>
            </div>
            <input
              type="number"
              v-model.number="archiveRetentionDays"
              class="input w-24"
              min="30"
              max="365"
            />
          </div>
          
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900">Last Data Refresh</h3>
              <p class="text-sm text-gray-500">{{ lastRefresh || 'Never' }}</p>
            </div>
            <button @click="triggerRefresh" :disabled="refreshing" class="btn-primary">
              {{ refreshing ? 'Refreshing...' : 'Refresh Now' }}
            </button>
          </div>
          
          <div class="flex items-center justify-between" v-if="qboConnected">
            <div>
              <h3 class="font-medium text-gray-900">Test QBO Connection</h3>
              <p class="text-sm text-gray-500">Debug QuickBooks API connection</p>
            </div>
            <button @click="testQBOConnection" :disabled="testingQBO" class="btn-secondary">
              {{ testingQBO ? 'Testing...' : 'Test QBO' }}
            </button>
          </div>
          
          <div class="flex items-center justify-between" v-if="qboConnected">
            <div>
              <h3 class="font-medium text-gray-900">Test September 2025 Data</h3>
              <p class="text-sm text-gray-500">Test specific month data for debugging</p>
            </div>
            <button @click="testSeptemberData" :disabled="testingSeptember" class="btn-secondary">
              {{ testingSeptember ? 'Testing...' : 'Test September' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- QBO Test Results Modal -->
    <div v-if="showQBOTestModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4 max-h-screen overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">QuickBooks Test Results</h3>
          <button @click="showQBOTestModal = false" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="space-y-4" v-if="qboTestResults">
          <!-- Status -->
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 rounded-full" :class="qboTestResults.status === 'connected' ? 'bg-green-500' : 'bg-red-500'"></div>
            <span class="font-medium">Status: {{ qboTestResults.status }}</span>
          </div>
          
          <!-- Environment -->
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-sm font-medium text-gray-700">Environment</div>
            <div class="text-sm text-gray-600">{{ qboTestResults.environment }}</div>
          </div>
          
          <!-- Company Info -->
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-sm font-medium text-gray-700">Company</div>
            <div class="text-sm text-gray-600">{{ qboTestResults.tests?.companyInfo?.companyName || 'Unknown' }}</div>
            <div class="text-xs text-gray-500" v-if="qboTestResults.tests?.companyInfo?.country">
              {{ qboTestResults.tests.companyInfo.country }}
            </div>
          </div>
          
          <!-- Data Summary -->
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-blue-50 rounded-lg p-3">
              <div class="text-sm font-medium text-blue-700">Invoices</div>
              <div class="text-lg font-bold text-blue-900">{{ qboTestResults.tests?.invoices?.count || 0 }}</div>
              <div class="text-xs text-blue-600">Last 30 days</div>
            </div>
            <div class="bg-green-50 rounded-lg p-3">
              <div class="text-sm font-medium text-green-700">Income Accounts</div>
              <div class="text-lg font-bold text-green-900">{{ qboTestResults.tests?.accounts?.incomeAccountCount || 0 }}</div>
              <div class="text-xs text-green-600">Active accounts</div>
            </div>
          </div>
          
          <!-- Total Invoice Count -->
          <div class="bg-gray-50 rounded-lg p-3" v-if="qboTestResults.tests?.totalInvoiceCount">
            <div class="text-sm font-medium text-gray-700">Total Invoices in QBO</div>
            <div class="text-sm text-gray-600">{{ qboTestResults.tests.totalInvoiceCount }}</div>
          </div>
          
          <!-- Sample Data -->
          <div v-if="qboTestResults.tests?.invoices?.samples?.length > 0" class="bg-gray-50 rounded-lg p-3">
            <div class="text-sm font-medium text-gray-700 mb-2">Sample Invoices</div>
            <div class="space-y-1">
              <div v-for="invoice in qboTestResults.tests.invoices.samples" :key="invoice.DocNumber" class="text-xs text-gray-600">
                #{{ invoice.DocNumber }} - {{ invoice.CustomerName }} - ${{ invoice.TotalAmt }}
              </div>
            </div>
          </div>
          
          <div v-if="qboTestResults.tests?.accounts?.samples?.length > 0" class="bg-gray-50 rounded-lg p-3">
            <div class="text-sm font-medium text-gray-700 mb-2">Sample Accounts</div>
            <div class="space-y-1">
              <div v-for="account in qboTestResults.tests.accounts.samples" :key="account.Name" class="text-xs text-gray-600">
                {{ account.Name }} ({{ account.AccountSubType }})
              </div>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3 mt-6">
          <button @click="showQBOTestModal = false" class="btn-secondary">
            Close
          </button>
          <button @click="copyTestResults" class="btn-primary">
            Copy Details
          </button>
        </div>
      </div>
    </div>
    
    <!-- September Test Results Modal -->
    <div v-if="showSeptemberTestModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-screen overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">September 2025 Data Test Results</h3>
          <button @click="showSeptemberTestModal = false" class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="space-y-6" v-if="septemberTestResults">
          <!-- Data Summary -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-blue-50 rounded-lg p-4">
              <div class="text-sm font-medium text-blue-700">Invoices Found</div>
              <div class="text-2xl font-bold text-blue-900">{{ septemberTestResults.dataCounts?.invoices || 0 }}</div>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
              <div class="text-sm font-medium text-green-700">Journal Entries</div>
              <div class="text-2xl font-bold text-green-900">{{ septemberTestResults.dataCounts?.journalEntries || 0 }}</div>
            </div>
            <div class="bg-yellow-50 rounded-lg p-4">
              <div class="text-sm font-medium text-yellow-700">Delayed Charges</div>
              <div class="text-2xl font-bold text-yellow-900">{{ septemberTestResults.dataCounts?.delayedCharges || 0 }}</div>
            </div>
          </div>
          
          <!-- Pipedrive Data Summary -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div class="bg-purple-50 rounded-lg p-4">
              <div class="text-sm font-medium text-purple-700">Open Deals (Total)</div>
              <div class="text-2xl font-bold text-purple-900">{{ septemberTestResults.dataCounts?.pipedriveOpenDeals || 0 }}</div>
            </div>
            <div class="bg-purple-50 rounded-lg p-4">
              <div class="text-sm font-medium text-purple-700">Won Unscheduled</div>
              <div class="text-2xl font-bold text-purple-900">{{ septemberTestResults.dataCounts?.pipedriveWonUnscheduled || 0 }}</div>
            </div>
          </div>
          
          <!-- Pipedrive Calculations -->
          <div class="bg-indigo-50 rounded-lg p-4 mt-4">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">Pipedrive Revenue Calculations</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span class="text-sm text-gray-600">Weighted Sales (Sept 2025):</span>
                <p class="text-xl font-bold text-indigo-600">${{ septemberTestResults.calculations?.pipedriveWeightedSales?.toFixed(2) || '0.00' }}</p>
              </div>
              <div>
                <span class="text-sm text-gray-600">Won Unscheduled (Sept 2025):</span>
                <p class="text-xl font-bold text-indigo-600">${{ septemberTestResults.calculations?.pipedriveWonUnscheduled?.toFixed(2) || '0.00' }}</p>
              </div>
            </div>
          </div>
          
          <!-- Revenue Calculations -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">Revenue Calculations</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div class="text-sm font-medium text-gray-700">Invoiced Total</div>
                <div class="text-xl font-bold text-gray-900">${{ septemberTestResults.calculations?.invoicedTotal?.toFixed(2) || '0.00' }}</div>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-700">Journal Entries Total</div>
                <div class="text-xl font-bold text-gray-900">${{ septemberTestResults.calculations?.journalEntriesTotal?.toFixed(2) || '0.00' }}</div>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-700">Monthly Recurring Total</div>
                <div class="text-xl font-bold text-gray-900">${{ septemberTestResults.calculations?.monthlyRecurringTotal?.toFixed(2) || '0.00' }}</div>
              </div>
            </div>
          </div>
          
          <!-- Revenue Calculation Note -->
          <div v-if="septemberTestResults.insights?.unearnedRevenueExcluded" class="bg-blue-50 rounded-lg p-3">
            <div class="flex items-start">
              <svg class="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
              </svg>
              <div>
                <h4 class="text-sm font-medium text-blue-800">Revenue Calculation Note</h4>
                <p class="text-sm text-blue-700 mt-1">Journal entries with "Unearned" revenue accounts are excluded from the revenue total as they represent deferred revenue.</p>
              </div>
            </div>
          </div>

          <!-- Sample Data -->
          <div v-if="septemberTestResults.samples" class="space-y-4">
            <!-- Sample Invoices with Line Items -->
            <div v-if="septemberTestResults.samples?.invoicesWithLineItems?.length > 0">
              <h4 class="text-lg font-semibold text-gray-900 mb-2">Sample Invoices with Line Item Details</h4>
              <div class="space-y-4">
                <div v-for="invoice in septemberTestResults.samples.invoicesWithLineItems" :key="invoice.docNumber" 
                     class="border rounded-lg p-4 bg-white">
                  <!-- Invoice Header -->
                  <div class="flex justify-between items-center mb-3 pb-2 border-b">
                    <div>
                      <span class="font-semibold text-gray-900">{{ invoice.docNumber }}</span>
                      <span class="text-gray-500 ml-2">{{ invoice.date }}</span>
                      <span class="text-gray-500 ml-2">{{ invoice.customer || 'N/A' }}</span>
                    </div>
                    <div class="text-right">
                      <span class="text-lg font-semibold text-gray-900">${{ invoice.amount?.toFixed(2) || '0.00' }}</span>
                    </div>
                  </div>
                  
                  <!-- Line Items -->
                  <div v-if="invoice.lines?.length > 0">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Revenue Line Items ({{ invoice.lines.length }})</h5>
                    <div class="overflow-x-auto">
                      <table class="min-w-full text-xs">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-2 py-1 text-left font-medium text-gray-500">Description</th>
                            <th class="px-2 py-1 text-left font-medium text-gray-500">Revenue Account</th>
                            <th class="px-2 py-1 text-left font-medium text-gray-500">Item</th>
                            <th class="px-2 py-1 text-right font-medium text-gray-500">Amount</th>
                            <th class="px-2 py-1 text-center font-medium text-gray-500">Monthly?</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                          <tr v-for="line in invoice.lines" :key="line.lineNum">
                            <td class="px-2 py-1 text-gray-900">{{ line.description || 'N/A' }}</td>
                            <td class="px-2 py-1 text-gray-600">
                              <div v-if="line.revenueAccountName">
                                {{ line.revenueAccountName }}
                                <span v-if="line.revenueAccountNumber" class="text-gray-400">({{ line.revenueAccountNumber }})</span>
                              </div>
                              <span v-else class="text-gray-400">N/A</span>
                            </td>
                            <td class="px-2 py-1 text-gray-600">{{ line.itemName || 'N/A' }}</td>
                            <td class="px-2 py-1 text-right font-medium">{{ line.amount?.toFixed(2) || '0.00' }}</td>
                            <td class="px-2 py-1 text-center">
                              <span v-if="line.hasMonthly" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Yes
                              </span>
                              <span v-else class="text-gray-400">No</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500 italic">
                    No revenue line items found
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Sample Journal Entries with Revenue Lines -->
            <div v-if="septemberTestResults.samples?.journalEntriesWithRevenueLines?.length > 0">
              <h4 class="text-lg font-semibold text-gray-900 mb-2">Sample Journal Entries with Revenue Line Details</h4>
              <div class="space-y-4">
                <div v-for="entry in septemberTestResults.samples.journalEntriesWithRevenueLines" :key="entry.docNumber" 
                     class="border rounded-lg p-4 bg-white">
                  <!-- Journal Entry Header -->
                  <div class="flex justify-between items-center mb-3 pb-2 border-b">
                    <div>
                      <span class="font-semibold text-gray-900">{{ entry.docNumber }}</span>
                      <span class="text-gray-500 ml-2">{{ entry.date }}</span>
                      <span class="text-gray-500 ml-2">{{ entry.totalLines }} total lines</span>
                    </div>
                    <div class="text-right">
                      <div class="text-lg font-semibold text-gray-900">${{ entry.totalAmount?.toFixed(2) || '0.00' }}</div>
                      <div class="text-xs text-gray-500">
                        <span class="text-green-600">Included: ${{ entry.includedRevenueTotal?.toFixed(2) || '0.00' }}</span>
                        <span v-if="entry.excludedUnearnedTotal > 0" class="ml-2 text-yellow-600">
                          Excluded: ${{ entry.excludedUnearnedTotal?.toFixed(2) || '0.00' }}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Private Note -->
                  <div v-if="entry.privateNote" class="mb-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                    <strong>Note:</strong> {{ entry.privateNote }}
                  </div>
                  
                  <!-- Revenue Lines -->
                  <div v-if="entry.revenueLines?.length > 0">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Revenue Account Lines ({{ entry.revenueLines.length }})</h5>
                    <div class="overflow-x-auto">
                      <table class="min-w-full text-xs">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-2 py-1 text-left font-medium text-gray-500">Description</th>
                            <th class="px-2 py-1 text-left font-medium text-gray-500">Revenue Account</th>
                            <th class="px-2 py-1 text-center font-medium text-gray-500">Type</th>
                            <th class="px-2 py-1 text-right font-medium text-gray-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                          <tr v-for="(line, idx) in entry.revenueLines" :key="idx" 
                              :class="line.isUnearned ? 'bg-yellow-50' : ''">
                            <td class="px-2 py-1 text-gray-900">
                              {{ line.description || 'N/A' }}
                              <span v-if="line.isUnearned" class="ml-2 text-xs bg-yellow-200 text-yellow-800 px-1 rounded">
                                UNEARNED
                              </span>
                            </td>
                            <td class="px-2 py-1 text-gray-600">
                              <div v-if="line.accountName">
                                {{ line.accountName }}
                                <span v-if="line.accountNumber" class="text-gray-400">({{ line.accountNumber }})</span>
                              </div>
                              <span v-else class="text-gray-400">N/A</span>
                            </td>
                            <td class="px-2 py-1 text-center">
                              <span :class="line.postingType === 'Credit' ? 'text-green-600' : 'text-blue-600'" class="font-medium">
                                {{ line.postingType || 'N/A' }}
                              </span>
                            </td>
                            <td class="px-2 py-1 text-right font-medium">
                              {{ line.amount?.toFixed(2) || '0.00' }}
                              <span v-if="line.isUnearned" class="ml-1 text-xs text-gray-500">(excluded)</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500 italic">
                    No revenue account lines found
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Sample Delayed Charges with Details -->
            <div v-if="septemberTestResults.samples?.delayedChargesWithDetails?.length > 0">
              <h4 class="text-lg font-semibold text-gray-900 mb-2">Sample Delayed Charges with Details</h4>
              <div class="space-y-4">
                <div v-for="charge in septemberTestResults.samples.delayedChargesWithDetails" :key="charge.docNumber" 
                     class="border rounded-lg p-4 bg-white">
                  <!-- Charge Header -->
                  <div class="flex justify-between items-center mb-3 pb-2 border-b">
                    <div>
                      <span class="font-semibold text-gray-900">{{ charge.docNumber }}</span>
                      <span class="text-gray-500 ml-2">{{ charge.date }}</span>
                      <span class="text-gray-500 ml-2">{{ charge.customer || 'N/A' }}</span>
                    </div>
                    <div class="text-right">
                      <span class="text-lg font-semibold text-gray-900">${{ charge.amount?.toFixed(2) || '0.00' }}</span>
                    </div>
                  </div>
                  
                  <!-- Line Details -->
                  <div v-if="charge.lineDetails?.length > 0">
                    <h5 class="text-sm font-medium text-gray-700 mb-2">Line Items ({{ charge.lineDetails.length }})</h5>
                    <div class="space-y-1">
                      <div v-for="(line, idx) in charge.lineDetails" :key="idx" class="flex justify-between text-sm">
                        <span class="text-gray-900">{{ line.description || 'N/A' }}</span>
                        <span class="font-medium">${{ line.amount?.toFixed(2) || '0.00' }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500 italic">
                    No line item details available
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Sample Pipedrive Open Deals for September 2025 -->
            <div v-if="septemberTestResults.samples?.pipedriveOpenDealsForSeptember?.length > 0">
              <h4 class="text-lg font-semibold text-gray-900 mb-2">Pipedrive Open Deals for September 2025</h4>
              <div class="bg-white border rounded-lg overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Deal</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                      <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Expected Close</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                      <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Probability</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Weighted Value</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr v-for="deal in septemberTestResults.samples.pipedriveOpenDealsForSeptember" :key="deal.id">
                      <td class="px-4 py-2 text-sm font-medium text-gray-900">{{ deal.title }}</td>
                      <td class="px-4 py-2 text-sm text-gray-500">{{ deal.orgName || 'N/A' }}</td>
                      <td class="px-4 py-2 text-sm text-gray-500 text-center">{{ deal.expectedCloseDate }}</td>
                      <td class="px-4 py-2 text-sm text-gray-900 text-right">${{ deal.value?.toFixed(2) || '0.00' }}</td>
                      <td class="px-4 py-2 text-sm text-center">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {{ deal.probability || 0 }}%
                        </span>
                      </td>
                      <td class="px-4 py-2 text-sm font-medium text-right">
                        <span class="text-green-600">${{ deal.calculatedWeightedValue?.toFixed(2) || '0.00' }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else-if="septemberTestResults.dataCounts?.pipedriveOpenDeals > 0">
              <h4 class="text-lg font-semibold text-gray-900 mb-2">Pipedrive Open Deals</h4>
              <p class="text-sm text-gray-500 italic">No open deals found with expected close date in September 2025</p>
            </div>
          </div>
          
          <!-- Issues -->
          <div v-if="septemberTestResults.insights?.potentialIssues?.length > 0" class="bg-red-50 rounded-lg p-4">
            <h4 class="text-lg font-semibold text-red-800 mb-2">Potential Issues</h4>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="issue in septemberTestResults.insights.potentialIssues" :key="issue" class="text-sm text-red-700">
                {{ issue }}
              </li>
            </ul>
          </div>
          
          <!-- Success Message -->
          <div v-else class="bg-green-50 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              <span class="text-green-800 font-medium">No issues detected - data looks good!</span>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3 mt-6">
          <button @click="showSeptemberTestModal = false" class="btn-secondary">
            Close
          </button>
          <button @click="copySeptemberResults" class="btn-primary">
            Copy Results
          </button>
        </div>
      </div>
    </div>
    
    <!-- Pipedrive Modal -->
    <div v-if="showPipedriveModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Pipedrive API Key</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Token</label>
            <input
              type="password"
              v-model="pipedriveApiKey"
              class="input"
              placeholder="Enter your Pipedrive API token"
            />
          </div>
          <div class="flex justify-end space-x-3">
            <button @click="showPipedriveModal = false" class="btn-secondary">
              Cancel
            </button>
            <button @click="savePipedriveKey" class="btn-primary">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useDarkMode } from '../composables/useDarkMode'
import AppLayout from '../components/AppLayout.vue'

const authStore = useAuthStore()
const { isDarkMode, toggleDarkMode } = useDarkMode()

const showPipedriveModal = ref(false)
const pipedriveApiKey = ref('')
const archiveRetentionDays = ref(365)
const refreshing = ref(false)
const lastRefresh = ref(null)
const testingQBO = ref(false)
const testingSeptember = ref(false)
const showQBOTestModal = ref(false)
const showSeptemberTestModal = ref(false)
const qboTestResults = ref(null)
const septemberTestResults = ref(null)

const qboConnected = ref(false)
const pipedriveConnected = ref(false)

const editingCompany = ref(false)
const editableCompanyName = ref('')

const company = computed(() => authStore.company)

async function connectQBO() {
  try {
    const response = await fetch('/.netlify/functions/qbo-oauth-start', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to start QuickBooks OAuth')
    }
    
    const data = await response.json()
    
    // Redirect to QuickBooks OAuth
    window.location.href = data.data.authUrl
    
  } catch (error) {
    console.error('Error starting QuickBooks OAuth:', error)
    alert('Failed to connect QuickBooks: ' + error.message)
  }
}

function disconnectQBO() {
  // This would disconnect QBO
  console.log('Disconnect QuickBooks Online')
}

async function savePipedriveKey() {
  try {
    const response = await fetch('/.netlify/functions/pipedrive-connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ apiKey: pipedriveApiKey.value })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to save Pipedrive key')
    }
    
    showPipedriveModal.value = false
    pipedriveApiKey.value = ''
    await checkConnectionStatus()
    
  } catch (error) {
    console.error('Error saving Pipedrive key:', error)
    alert('Failed to save Pipedrive key: ' + error.message)
  }
}

async function saveCompanyInfo() {
  try {
    const response = await fetch('/.netlify/functions/company-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ 
        name: editableCompanyName.value 
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update company info')
    }
    
    // Update the auth store with the new company info
    await authStore.fetchCurrentUser()
    editingCompany.value = false
    
  } catch (error) {
    console.error('Error saving company info:', error)
    alert('Failed to save company information: ' + error.message)
  }
}

async function triggerRefresh() {
  refreshing.value = true
  try {
    // This would trigger a data refresh
    await new Promise(resolve => setTimeout(resolve, 2000))
    lastRefresh.value = new Date().toLocaleString()
  } finally {
    refreshing.value = false
  }
}

async function checkConnectionStatus() {
  try {
    const response = await fetch('/.netlify/functions/settings-status', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      pipedriveConnected.value = data.data.pipedrive.connected
      qboConnected.value = data.data.quickbooks.connected
    }
  } catch (error) {
    console.log('Connection status check failed:', error)
  }
}

async function testQBOConnection() {
  testingQBO.value = true
  try {
    const response = await fetch('/.netlify/functions/qbo-test', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('QBO Test Results:', result)
      
      // Handle both wrapped and unwrapped response formats
      const data = result.data || result
      
      qboTestResults.value = data
      showQBOTestModal.value = true
    } else {
      const errorData = await response.json()
      console.error('QBO test failed:', errorData)
      alert(`QBO Test Failed: ${errorData.error}`)
    }
  } catch (error) {
    console.error('Error testing QBO connection:', error)
    alert('Failed to test QBO connection: ' + error.message)
  } finally {
    testingQBO.value = false
  }
}

function copyTestResults() {
  if (!qboTestResults.value) return
  
  const results = qboTestResults.value
  const text = `QuickBooks Test Results:

Status: ${results.status || 'Unknown'}
Environment: ${results.environment || 'Unknown'}
Company: ${results.tests?.companyInfo?.companyName || 'Unknown'}
Country: ${results.tests?.companyInfo?.country || 'Unknown'}

Data Summary:
- Invoices (Last 30 days): ${results.tests?.invoices?.count || 0}
- Income Accounts: ${results.tests?.accounts?.incomeAccountCount || 0}
- Total Invoices in QBO: ${results.tests?.totalInvoiceCount || 0}

Debug Info:
- Realm ID: ${results.debug?.realmId || 'Unknown'}
- API URL: ${results.debug?.apiUrl || 'Unknown'}

Generated: ${new Date().toISOString()}`

  navigator.clipboard.writeText(text).then(() => {
    alert('Test results copied to clipboard!')
  }).catch(() => {
    alert('Failed to copy to clipboard. Check console for full results.')
  })
}

async function testSeptemberData() {
  testingSeptember.value = true
  try {
    const response = await fetch('/.netlify/functions/test-september-data', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('September 2025 Test Results:', result)
      
      // Handle both wrapped and unwrapped response formats
      const data = result.data || result
      septemberTestResults.value = data
      showSeptemberTestModal.value = true
    } else {
      const errorData = await response.json()
      console.error('September test failed:', errorData)
      alert(`September Test Failed: ${errorData.error}`)
    }
  } catch (error) {
    console.error('Error testing September data:', error)
    alert('Failed to test September data: ' + error.message)
  } finally {
    testingSeptember.value = false
  }
}

function copySeptemberResults() {
  if (!septemberTestResults.value) return
  
  const results = septemberTestResults.value
  let text = `September 2025 Data Test Results:

Data Found:
- Invoices: ${results.dataCounts?.invoices || 0}
- Journal Entries: ${results.dataCounts?.journalEntries || 0}
- Delayed Charges: ${results.dataCounts?.delayedCharges || 0}
- Pipedrive Open Deals: ${results.dataCounts?.pipedriveOpenDeals || 0}
- Pipedrive Won Unscheduled: ${results.dataCounts?.pipedriveWonUnscheduled || 0}

Revenue Calculations:
- Invoiced Total: $${results.calculations?.invoicedTotal?.toFixed(2) || '0.00'}
- Journal Entries Total: $${results.calculations?.journalEntriesTotal?.toFixed(2) || '0.00'} (excluding unearned revenue)
- Monthly Recurring Total: $${results.calculations?.monthlyRecurringTotal?.toFixed(2) || '0.00'}

Has Non-Invoiced Revenue: ${results.insights?.hasNonInvoicedRevenue ? 'Yes' : 'No'}

Sample Data Analysis:
- Sample Invoices: ${results.samples?.invoicesWithLineItems?.length || 0}
- Sample Journal Entries: ${results.samples?.journalEntriesWithRevenueLines?.length || 0}
- Sample Delayed Charges: ${results.samples?.delayedChargesWithDetails?.length || 0}

${results.insights?.potentialIssues?.length > 0 ? 
  'Potential Issues:\n' + results.insights.potentialIssues.map(issue => '- ' + issue).join('\n') : 
  'No issues detected - data looks good!'
}

Generated: ${new Date().toISOString()}`

  // Add detailed line item information if available
  if (results.samples?.invoicesWithLineItems?.length > 0) {
    text += '\n\nDetailed Invoice Line Items:\n'
    results.samples.invoicesWithLineItems.forEach(inv => {
      text += `\nInvoice ${inv.docNumber} (${inv.date}):\n`
      if (inv.lines?.length > 0) {
        inv.lines.forEach(line => {
          text += `  - ${line.description || 'No description'}: $${line.amount?.toFixed(2) || '0.00'}`
          text += ` (${line.revenueAccountName || 'No account'})`
          text += line.hasMonthly ? ' [MONTHLY]' : ''
          text += '\n'
        })
      } else {
        text += '  No revenue line items found\n'
      }
    })
  }

  navigator.clipboard.writeText(text).then(() => {
    alert('September test results copied to clipboard!')
  }).catch(() => {
    alert('Failed to copy to clipboard. Check console for full results.')
  })
}

// Watch for editing company to populate the field
watch(() => editingCompany.value, (isEditing) => {
  if (isEditing) {
    editableCompanyName.value = company.value?.name || ''
  }
})

onMounted(async () => {
  // Load current settings
  lastRefresh.value = 'Today at 3:00 AM'
  await checkConnectionStatus()
})
</script>