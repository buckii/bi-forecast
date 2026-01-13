<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-7xl mx-4 max-h-screen overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ modalTitle }}</h3>
          <!-- Cache/Fetch Info with Refresh Button -->
          <div v-if="activeTab === 'transactions' && cacheMetadata.transactionsCachedAt"
            class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span v-if="cacheMetadata.transactionsFromCache">
              Cached {{ formatRelativeTime(cacheMetadata.transactionsCachedAt) }}
            </span>
            <span v-else>
              Fetched {{ formatRelativeTime(cacheMetadata.transactionsCachedAt) }}
            </span>
            <button @click="refreshData" :disabled="refreshing || loading"
              class="p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data">
              <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <div v-if="activeTab === 'clients' && cacheMetadata.clientsCachedAt"
            class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span v-if="cacheMetadata.clientsFromCache">
              Cached {{ formatRelativeTime(cacheMetadata.clientsCachedAt) }}
            </span>
            <span v-else>
              Fetched {{ formatRelativeTime(cacheMetadata.clientsCachedAt) }}
            </span>
            <button @click="refreshData" :disabled="refreshing || loading"
              class="p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data">
              <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': refreshing }" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button @click="exportToCSV"
            class="hidden sm:inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
            :disabled="loading || allTransactions.length === 0" title="Export list to CSV">
            <ArrowDownTrayIcon class="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400" />
            Export
          </button>
          <button @click="$emit('close')" class="text-gray-400 hover:text-gray-500 focus:outline-none">
            <span class="sr-only">Close</span>
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>
      </div>

      <!-- Loading Progress -->
      <!-- Loading Progress -->
      <div v-if="loading" class="mb-4 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs font-semibold text-blue-700 dark:text-blue-300">{{ loadingStatus || 'Loading...'
            }}</span>
          <span class="text-xs font-semibold text-blue-700 dark:text-blue-300">{{ loadingProgress }}%</span>
        </div>
        <div class="w-full bg-blue-200 dark:bg-blue-800/40 rounded-full h-1.5">
          <div class="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
            :style="{ width: loadingProgress + '%' }"></div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="-mb-px flex space-x-8">
          <button @click="activeTab = 'transactions'" :class="[
            'py-2 px-1 border-b-2 font-medium text-sm',
            activeTab === 'transactions'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
          ]">
            Transactions
          </button>
          <button @click="activeTab = 'clients'" :class="[
            'py-2 px-1 border-b-2 font-medium text-sm',
            activeTab === 'clients'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
          ]">
            Clients
          </button>
        </nav>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
        <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      </div>

      <!-- Transactions Tab -->
      <div v-else-if="activeTab === 'transactions' && allTransactions" class="space-y-6">
        <!-- Summary -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
              <p class="text-2xl font-bold text-primary-600">{{ formatCurrency(filteredTotalAmount) }}</p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">Transaction Count</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ filteredTransactions.length }}</p>
            </div>
          </div>
        </div>

        <!-- Filter Toggles -->
        <div class="space-y-3">
          <div class="flex flex-wrap gap-3 items-center">
            <button @click="toggleAllFilters"
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium w-20 text-left">
              {{ allFiltersEnabled ? 'Hide All' : 'Show All' }}
            </button>
            <div class="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
            <label v-for="type in transactionTypes" :key="type.value"
              class="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" v-model="enabledTypes[type.value]"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ type.label }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">({{ getTypeCount(type.value) }})</span>
            </label>
          </div>

          <!-- Sort Options -->
          <div class="flex items-center space-x-4 text-sm">
            <span class="text-gray-500 dark:text-gray-400">Sort by:</span>
            <button @click="toggleSort('amount')" :class="[
              'hover:underline font-medium',
              sortBy === 'amount' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-300'
            ]">
              Amount {{ sortBy === 'amount' ? (sortDirection === 'desc' ? '↓' : '↑') : '' }}
            </button>
            <button @click="toggleSort('date')" :class="[
              'hover:underline font-medium',
              sortBy === 'date' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-300'
            ]">
              Date {{ sortBy === 'date' ? (sortDirection === 'desc' ? '↓' : '↑') : '' }}
            </button>
          </div>
        </div>

        <!-- Transactions List (Table Format) -->
        <div v-if="filteredTransactions.length > 0" class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-700 dark:text-gray-300">
              <tr>
                <th class="px-3 py-3 text-left font-medium w-32">Type</th>
                <th class="px-3 py-3 text-left font-medium w-28">Doc #</th>
                <th class="px-3 py-3 text-left font-medium w-32">Date</th>
                <th class="px-3 py-3 text-left font-medium">Client</th>
                <th class="px-3 py-3 text-left font-medium">Description</th>
                <th class="px-3 py-3 text-right font-medium w-32">Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <template v-for="transaction in filteredTransactions" :key="transaction.id">
                <tr @click="transaction.type !== 'delayedCharge' ? toggleDetails(transaction.id) : null" :class="[
                  transaction.type !== 'delayedCharge' ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : '',
                  'transition-colors',
                  transaction.description?.toLowerCase().includes('annual') ? 'opacity-60' : ''
                ]">
                  <td class="px-3 py-3">
                    <div class="flex items-center">
                      <svg v-if="transaction.type !== 'delayedCharge'"
                        class="w-4 h-4 text-gray-400 mr-2 transform transition-transform duration-200"
                        :class="{ 'rotate-90': expandedTransactions.has(transaction.id) }" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                      <span
                        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                        :class="[getTypeColor(transaction.type), transaction.type === 'delayedCharge' ? '' : 'ml-0']"
                        :style="transaction.type === 'delayedCharge' ? 'margin-left: 24px' : ''">
                        {{ formatTransactionType(transaction.type) }}
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-3 font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {{ transaction.docNumber }}
                  </td>
                  <td class="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {{ formatTransactionDate(transaction.date) }}
                  </td>
                  <td class="px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {{ transaction.customer }}
                  </td>
                  <td class="px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
                    <div class="truncate max-w-md">{{ transaction.description }}</div>
                  </td>
                  <td class="px-3 py-3 text-right font-medium text-gray-900 dark:text-gray-100 relative">
                    {{ formatCurrency(transaction.amount) }}
                    <button v-if="transaction.type === 'invoice' || transaction.type === 'delayedCharge'"
                      @click.stop="createJournalEntryFromTransaction(transaction)"
                      class="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                      title="Create Journal Entry">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <button v-if="transaction.type === 'journalEntry'" @click.stop="editJournalEntry(transaction)"
                      class="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Edit Journal Entry">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </td>
                </tr>
                <tr v-if="transaction.type !== 'delayedCharge' && expandedTransactions.has(transaction.id)"
                  class="bg-gray-50 dark:bg-gray-700">
                  <td colspan="6" class="px-3 py-4">
                    <div class="space-y-2">
                      <h4 class="font-medium text-gray-900 dark:text-gray-100 text-sm mb-2">Transaction Details</h4>
                      <div class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {{ JSON.stringify(transaction.details, null, 2) }}
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- No Transactions -->
        <div v-else class="text-center py-8">
          <p class="text-gray-500 dark:text-gray-400">No transactions match the selected filters.</p>
        </div>
      </div>

      <!-- Clients Tab -->
      <div v-else-if="activeTab === 'clients' && clientData" class="space-y-6">
        <!-- Summary -->
        <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
              <p class="text-2xl font-bold text-primary-600">{{ formatCurrency(clientTotalRevenue) }}</p>
            </div>
            <div class="text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400">Client Count</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ sortedClients.length }}</p>
            </div>
          </div>
        </div>

        <!-- Filter Toggles and Sorting -->
        <div class="space-y-3">
          <!-- Transaction Type Filters -->
          <div class="flex flex-wrap gap-3 items-center">
            <button @click="toggleAllClientFilters"
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium w-20 text-left">
              {{ allClientFiltersEnabled ? 'Hide All' : 'Show All' }}
            </button>
            <div class="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
            <label v-for="type in transactionTypes" :key="type.value"
              class="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" v-model="clientEnabledTypes[type.value]"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ type.label }}</span>
            </label>
          </div>

          <!-- Sort Options -->
          <div class="flex items-center space-x-4 text-sm">
            <span class="text-gray-500 dark:text-gray-400">Sort by:</span>
            <button @click="toggleClientSort('amount')" :class="[
              'hover:underline font-medium',
              clientSortBy === 'amount' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-300'
            ]">
              Amount {{ clientSortBy === 'amount' ? (clientSortDirection === 'desc' ? '↓' : '↑') : '' }}
            </button>
            <button @click="toggleClientSort('client')" :class="[
              'hover:underline font-medium',
              clientSortBy === 'client' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-300'
            ]">
              Client (alpha) {{ clientSortBy === 'client' ? (clientSortDirection === 'desc' ? '↓' : '↑') : '' }}
            </button>
          </div>
        </div>

        <!-- Pie Chart -->
        <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Revenue by Client</h4>
          <div style="height: 300px;">
            <canvas ref="pieCanvas"></canvas>
          </div>
        </div>

        <!-- Client Table -->
        <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Client Breakdown</h4>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Client Name
                  </th>
                  <th scope="col"
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th scope="col"
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Approx. Points
                  </th>
                  <th scope="col"
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                <template v-for="client in sortedClients" :key="client.client">
                  <tr @click="toggleClient(client.client)"
                    class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      <div class="flex items-center">
                        <svg class="w-4 h-4 text-gray-400 mr-2 transform transition-transform duration-200"
                          :class="{ 'rotate-90': expandedClients.has(client.client) }" fill="none" stroke="currentColor"
                          viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                        {{ client.client }}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {{ formatCurrency(client.total) }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-300">
                      {{ formatPoints(client.total) }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                      {{ formatPercent(client.total, clientTotalRevenue) }}
                    </td>
                  </tr>

                  <!-- Expanded Transactions for Client -->
                  <tr v-if="expandedClients.has(client.client)" class="bg-gray-50 dark:bg-gray-800">
                    <td colspan="4" class="px-6 py-4">
                      <div class="space-y-2">
                        <h5 class="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">
                          Transactions for {{ client.client }}
                        </h5>
                        <div v-if="getClientTransactions(client.client).length === 0"
                          class="text-sm text-gray-500 dark:text-gray-400">
                          No transactions found
                        </div>
                        <div v-else class="space-y-1">
                          <div v-for="transaction in getClientTransactions(client.client)" :key="transaction.id"
                            class="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs">
                            <div class="flex items-center space-x-3 flex-1">
                              <span class="inline-flex items-center px-2 py-1 rounded-full font-medium"
                                :class="getTypeColor(transaction.type)">
                                {{ formatTransactionType(transaction.type) }}
                              </span>
                              <span class="font-medium text-gray-900 dark:text-gray-100">
                                {{ transaction.docNumber }}
                              </span>
                              <span class="text-gray-500 dark:text-gray-400">
                                {{ formatTransactionDate(transaction.date) }}
                              </span>
                            </div>
                            <div class="flex items-center space-x-3">
                              <span class="text-gray-700 dark:text-gray-300 truncate max-w-xs">
                                {{ transaction.description }}
                              </span>
                              <span class="font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap relative">
                                {{ formatCurrency(transaction.amount) }}
                                <button v-if="transaction.type === 'invoice' || transaction.type === 'delayedCharge'"
                                  @click.stop="createJournalEntryFromTransaction(transaction)"
                                  class="inline-flex ml-1 p-1 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors align-middle"
                                  title="Create Journal Entry">
                                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                                <button v-if="transaction.type === 'journalEntry'"
                                  @click.stop="editJournalEntry(transaction)"
                                  class="inline-flex ml-1 p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors align-middle"
                                  title="Edit Journal Entry">
                                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
                <tr class="bg-gray-50 dark:bg-gray-800 font-semibold">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    Total
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {{ formatCurrency(clientTotalRevenue) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-300">
                    {{ formatPoints(clientTotalRevenue) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                    100%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-3 mt-6 pt-4 border-t">
        <button @click="exportToCSV"
          class="hidden sm:inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
          :disabled="loading">
          <ArrowDownTrayIcon class="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400" />
          Export Detail
        </button>
        <button @click="closeModal" class="btn-secondary">
          Close
        </button>
      </div>
    </div>

    <!-- Journal Entry Create Modal -->
    <JournalEntryCreateModal v-if="showJournalEntryCreateModal" :revenueAccounts="journalEntryAccounts.revenue"
      :unearnedAccounts="journalEntryAccounts.unearned" :prefillData="journalEntryPrefillData"
      @close="closeJournalEntryCreateModal" @created="handleJournalEntryCreated" />

    <!-- Journal Entry Detail/Edit Modal -->
    <JournalEntryDetailModal v-if="selectedJournalEntry" :entry="selectedJournalEntry"
      @close="selectedJournalEntry = null" @updated="handleJournalEntryUpdated" @delete="handleJournalEntryDeleted" />

    <!-- Journal Entry Bulk Edit Modal -->
    <JournalEntryBulkEditModal v-if="showBulkEditModal" :initialEntryId="bulkEditEntryId"
      @close="showBulkEditModal = false" @updated="handleJournalEntryUpdated" />
  </div>
</template>

<script setup>
import {
  ArrowDownTrayIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { Chart, registerables } from 'chart.js'
import { addMonths, format as formatDate, isBefore, parseISO, startOfMonth } from 'date-fns'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isDarkModeGlobal } from '../composables/useDarkMode'
import { useAuthStore } from '../stores/auth'
import { useRevenueStore } from '../stores/revenue'
import JournalEntryBulkEditModal from './JournalEntryBulkEditModal.vue'
import JournalEntryCreateModal from './JournalEntryCreateModal.vue'
import JournalEntryDetailModal from './JournalEntryDetailModal.vue'


Chart.register(...registerables)

const revenueStore = useRevenueStore()
const router = useRouter()
const route = useRoute()

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  month: {
    type: String,
    default: ''
  },
  asOf: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  startDate: {
    type: String,
    default: ''
  },
  endDate: {
    type: String,
    default: ''
  },
  autoExport: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])



const authStore = useAuthStore()

// Get price per point from company settings
const pricePerPoint = computed(() => {
  return authStore.company?.settings?.pricePerPoint || 550
})

// Initialize tab from URL param, fallback to localStorage, default to 'transactions'
const getInitialTab = () => {
  if (route.query.modalTab) return route.query.modalTab
  return localStorage.getItem('transactionModal_lastTab') || 'transactions'
}
const activeTab = ref(getInitialTab())

// Auto-export logic
const loading = ref(true)

// Auto-export logic
watch(loading, (newLoading) => {
  if (!newLoading && props.isOpen && props.autoExport && allTransactions.value.length > 0) {
    setTimeout(() => {
      exportToCSV()
    }, 500)
  }
})
const loadingProgress = ref(0)
const loadingStatus = ref('')
const error = ref(null)
const allTransactions = ref([])
const clientData = ref(null)
const cacheMetadata = ref({
  transactionsCachedAt: null,
  transactionsFromCache: false,
  clientsCachedAt: null,
  clientsFromCache: false
})
const refreshing = ref(false)
const expandedTransactions = ref(new Set())
const expandedClients = ref(new Set())
const pieCanvas = ref(null)
let pieChartInstance = null

// Journal Entry Modal State
const showJournalEntryCreateModal = ref(false)
const journalEntryPrefillData = ref(null)
const selectedJournalEntry = ref(null)
const showBulkEditModal = ref(false)
const bulkEditEntryId = ref(null)
const journalEntryAccounts = ref({
  revenue: [],
  unearned: []
})

// Sorting state for Transactions tab
const sortBy = ref('amount')  // 'amount' | 'date'
const sortDirection = ref('desc')  // 'asc' | 'desc'

// Sorting state for Clients tab
const clientSortBy = ref('amount')  // 'amount' | 'client'
const clientSortDirection = ref('desc')  // 'asc' | 'desc'

// Transaction type filters
const transactionTypes = [
  { value: 'invoice', label: 'Invoiced' },
  { value: 'journalEntry', label: 'Journal Entries' },
  { value: 'delayedCharge', label: 'Delayed Charges' },
  { value: 'monthlyRecurring', label: 'Monthly Recurring' },
  { value: 'wonUnscheduled', label: 'Won Unscheduled' },
  { value: 'weightedSales', label: 'Weighted Sales' }
]

const enabledTypes = ref({
  invoice: true,
  journalEntry: true,
  delayedCharge: true,
  monthlyRecurring: true,
  wonUnscheduled: true,
  weightedSales: revenueStore.includeWeightedSales  // Respect dashboard toggle
})

// Separate filter state for Clients tab
const clientEnabledTypes = ref({
  invoice: true,
  journalEntry: true,
  delayedCharge: true,
  monthlyRecurring: true,
  wonUnscheduled: true,
  weightedSales: revenueStore.includeWeightedSales  // Respect dashboard toggle
})

const allFiltersEnabled = computed(() => {
  return Object.values(enabledTypes.value).every(v => v)
})

const allClientFiltersEnabled = computed(() => {
  return Object.values(clientEnabledTypes.value).every(v => v)
})

const filteredTransactions = computed(() => {
  if (!allTransactions.value) return []

  let filtered = allTransactions.value.filter(t => enabledTypes.value[t.type])

  // Apply sorting
  filtered.sort((a, b) => {
    if (sortBy.value === 'amount') {
      const diff = a.amount - b.amount
      return sortDirection.value === 'desc' ? -diff : diff
    } else {
      // Sort by date
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      const diff = dateA - dateB
      return sortDirection.value === 'desc' ? -diff : diff
    }
  })

  return filtered
})

const filteredTotalAmount = computed(() => {
  return filteredTransactions.value.reduce((sum, t) => sum + (t.amount || 0), 0)
})

const sortedClients = computed(() => {
  if (!clientData.value?.clients) return []

  // Recalculate client totals from transactions based on enabled filters
  const clientTotals = {}

  allTransactions.value
    .filter(t => clientEnabledTypes.value[t.type])
    .forEach(t => {
      if (!clientTotals[t.customer]) {
        clientTotals[t.customer] = 0
      }
      clientTotals[t.customer] += t.amount || 0
    })

  const clients = Object.entries(clientTotals)
    .map(([client, total]) => ({ client, total }))

  // Apply sorting
  clients.sort((a, b) => {
    if (clientSortBy.value === 'amount') {
      const diff = a.total - b.total
      return clientSortDirection.value === 'desc' ? -diff : diff
    } else {
      // Sort by client name (alpha)
      const comparison = a.client.localeCompare(b.client)
      return clientSortDirection.value === 'desc' ? -comparison : comparison
    }
  })

  return clients
})

const clientTotalRevenue = computed(() => {
  return sortedClients.value.reduce((sum, c) => sum + c.total, 0)
})

function getClientTransactions(clientName) {
  if (!allTransactions.value) return []

  // Filter transactions by client name and enabled types
  const transactions = allTransactions.value
    .filter(t => t.customer === clientName && clientEnabledTypes.value[t.type])
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return transactions
}

function getTypeCount(type) {
  if (!allTransactions.value) return 0
  return allTransactions.value.filter(t => t.type === type).length
}

function toggleAllFilters() {
  const newValue = !allFiltersEnabled.value
  Object.keys(enabledTypes.value).forEach(key => {
    enabledTypes.value[key] = newValue
  })
}

function toggleAllClientFilters() {
  const newValue = !allClientFiltersEnabled.value
  Object.keys(clientEnabledTypes.value).forEach(key => {
    clientEnabledTypes.value[key] = newValue
  })
}

function toggleSort(field) {
  if (sortBy.value === field) {
    // Toggle direction
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  } else {
    // Change field and set to descending
    sortBy.value = field
    sortDirection.value = 'desc'
  }
}

function toggleClientSort(field) {
  if (clientSortBy.value === field) {
    // Toggle direction
    clientSortDirection.value = clientSortDirection.value === 'desc' ? 'asc' : 'desc'
  } else {
    // Change field and set to descending
    clientSortBy.value = field
    clientSortDirection.value = 'desc'
  }
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen && (props.month || (props.startDate && props.endDate))) {
    loadAllData()
  } else {
    // Reset state when modal closes (but preserve activeTab for next open)
    allTransactions.value = []
    clientData.value = null
    error.value = null
    expandedTransactions.value.clear()
    expandedClients.value.clear()

    // Reset transaction filters and sorting
    sortBy.value = 'amount'
    sortDirection.value = 'desc'

    // Reset client filters and sorting
    clientSortBy.value = 'amount'
    clientSortDirection.value = 'desc'

    // Cleanup pie chart
    if (pieChartInstance) {
      pieChartInstance.destroy()
      pieChartInstance = null
    }
  }
}, { immediate: true })

// Sync weighted sales filter with dashboard toggle and reload data
watch(() => revenueStore.includeWeightedSales, (newValue) => {
  enabledTypes.value.weightedSales = newValue
  clientEnabledTypes.value.weightedSales = newValue

  // Reload data if modal is open to fetch/exclude weighted sales transactions
  if (props.isOpen && (props.month || (props.startDate && props.endDate))) {
    loadAllData()
  }
})

async function loadAllData(forceRefresh = false) {
  loading.value = true
  loadingStatus.value = 'Preparing to load data...'
  loadingProgress.value = 0
  error.value = null

  try {
    // List of months to fetch
    const monthsToFetch = []
    if (props.startDate && props.endDate) {
      monthsToFetch.push(...getMonthsInRange(props.startDate, props.endDate))
    } else {
      monthsToFetch.push(props.month)
    }

    // Fetch transaction types based on dashboard toggle
    const components = ['invoiced', 'journalEntries', 'delayedCharges', 'monthlyRecurring', 'wonUnscheduled']

    const totalSteps = components.length + 1 // +1 for client data
    let completedSteps = 0
    const updateProgress = (stepName) => {
      completedSteps++
      loadingProgress.value = Math.round((completedSteps / totalSteps) * 100)
      loadingStatus.value = `Loading ${stepName}... (${completedSteps}/${totalSteps})`
    }


    // Build common params
    const startMonth = monthsToFetch[0]
    const endMonth = monthsToFetch[monthsToFetch.length - 1]

    // Determine if we are doing a range request
    const isRangeRequest = monthsToFetch.length > 1

    const params = new URLSearchParams()

    if (isRangeRequest) {
      params.append('month_start', startMonth)
      params.append('month_end', endMonth)
    } else {
      params.append('month', startMonth)
    }

    if (props.asOf) {
      params.append('as_of', props.asOf)
    }
    if (forceRefresh) {
      params.append('_refresh', Date.now().toString())
    }

    // Fetch components
    const transactionResults = []

    // We can run these in parallel now since we only make one request per component for the whole range
    // But to be safe with QBO concurrency, we can still stagger them slightly or just await sequentially
    for (const component of components) {
      // Small delay between components
      await new Promise(r => setTimeout(r, 100))

      const componentParams = new URLSearchParams(params)
      componentParams.append('component', component)

      try {
        const response = await fetch(`/.netlify/functions/transaction-details?${componentParams.toString()}`, {
          headers: { 'Authorization': `Bearer ${authStore.token}` }
        })

        if (!response.ok) {
          transactionResults.push({ transactions: [], fromCache: false, cachedAt: null })
          updateProgress(component)
          continue
        }

        const result = await response.json()
        const data = result.data || result
        transactionResults.push({
          transactions: data.transactions || [],
          fromCache: data.fromCache || false,
          cachedAt: data.cachedAt || null
        })
        updateProgress(component)
      } catch (e) {
        console.error(`Error fetching ${component} for range ${startMonth}-${endMonth}:`, e)
        transactionResults.push({ transactions: [], fromCache: false, cachedAt: null })
        updateProgress(component)
      }
    }

    // Fetch client data
    const clientParams = new URLSearchParams({
      includeWeightedSales: revenueStore.includeWeightedSales.toString()
    })

    if (isRangeRequest) {
      clientParams.append('month_start', startMonth)
      clientParams.append('month_end', endMonth)
    } else {
      clientParams.append('month', startMonth)
    }

    if (props.asOf) {
      clientParams.append('as_of', props.asOf)
    }

    let clientResult = { clients: null, fromCache: false, cachedAt: null }
    try {
      const response = await fetch(`/.netlify/functions/revenue-by-client?${clientParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${authStore.token}` }
      })

      if (response.ok) {
        const result = await response.json()
        const data = result.data || result
        clientResult = {
          clients: data.clients || [],
          month: data.month,
          fromCache: data.fromCache || false,
          cachedAt: data.cachedAt || null
        }
      }
      updateProgress('Client Data')
    } catch (e) {
      console.error(`Error fetching client data for range ${startMonth}-${endMonth}:`, e)
      updateProgress('Client Data')
    }

    // Since we now have single results covering the whole range, we put them in a list of 1 to match aggregation logic or just assign directly
    const allResults = [{
      transactionResults,
      clientResult
    }]



    // Aggregate results
    let aggregatedTransactions = []
    let aggregatedClients = {} // Map by client name to sum totals
    let hasCache = false
    let latestCacheDate = null
    let clientHasCache = false
    let latestClientCacheDate = null

    for (const result of allResults) {
      // Aggregate transactions
      const txns = result.transactionResults.flatMap(r => r.transactions)
      aggregatedTransactions.push(...txns)

      // Check cache metadata for transactions
      const transactionsWithCache = result.transactionResults.filter(r => r.fromCache)
      if (transactionsWithCache.length > 0) hasCache = true
      const date = transactionsWithCache.map(r => r.cachedAt).filter(Boolean).sort().reverse()[0]
      if (date && (!latestCacheDate || new Date(date) > new Date(latestCacheDate))) {
        latestCacheDate = date
      }

      // Aggregate clients
      if (result.clientResult.clients) {
        if (result.clientResult.fromCache) clientHasCache = true
        if (result.clientResult.cachedAt && (!latestClientCacheDate || new Date(result.clientResult.cachedAt) > new Date(latestClientCacheDate))) {
          latestClientCacheDate = result.clientResult.cachedAt
        }

        for (const client of result.clientResult.clients) {
          if (!aggregatedClients[client.client]) {
            aggregatedClients[client.client] = { ...client, total: 0 }
            // Note: We might want to aggregate breakdown fields too (invoiced, recurring, etc.) 
            // but 'total' is the most critical for the pie chart.
            // Currently revenue-by-client returns breakdown. Detailed aggregation might be needed if detail view relies on it.
            // For now, let's assume 'total' is primary.
          }
          aggregatedClients[client.client].total += client.total || 0
        }
      }
    }

    allTransactions.value = aggregatedTransactions

    // Set cache metadata
    cacheMetadata.value = {
      transactionsFromCache: hasCache,
      transactionsCachedAt: latestCacheDate,
      clientsFromCache: clientHasCache,
      clientsCachedAt: latestClientCacheDate
    }

    // Set client data
    const aggregatedClientList = Object.values(aggregatedClients)
    clientData.value = aggregatedClientList.length > 0 ? {
      clients: aggregatedClientList,
      month: props.month || 'Multiple Months'
    } : null

    // If we're on the clients tab, create the pie chart
    if (activeTab.value === 'clients' && clientData.value?.clients) {
      setTimeout(() => createPieChart(), 100)
    }

  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function toggleDetails(transactionId) {
  if (expandedTransactions.value.has(transactionId)) {
    expandedTransactions.value.delete(transactionId)
  } else {
    expandedTransactions.value.add(transactionId)
  }
}

function toggleClient(clientName) {
  if (expandedClients.value.has(clientName)) {
    expandedClients.value.delete(clientName)
  } else {
    expandedClients.value.add(clientName)
  }
}

async function refreshData() {
  refreshing.value = true
  // Add a cache-busting timestamp to force fresh data
  const originalAsOf = props.asOf
  try {
    await loadAllData(true) // Pass true to indicate force refresh
  } finally {
    refreshing.value = false
  }
}

function closeModal() {
  emit('close')
}

function formatMonth(monthStr) {
  if (!monthStr) return ''
  try {
    const [year, month] = monthStr.split('-')
    const date = new Date(year, parseInt(month) - 1, 1)
    return formatDate(date, 'MMMM yyyy')
  } catch (e) {
    return monthStr
  }
}

const modalTitle = computed(() => {
  if (props.startDate && props.endDate) {
    try {
      const start = parseISO(props.startDate)
      const end = parseISO(props.endDate)
      // Check if start and end are the same month
      if (formatDate(start, 'yyyy-MM') === formatDate(end, 'yyyy-MM')) {
        return formatDate(start, 'MMMM yyyy')
      }
      return `${formatDate(start, 'MMM yyyy')} - ${formatDate(end, 'MMM yyyy')}`
    } catch (e) {
      return `${props.startDate} - ${props.endDate}`
    }
  }
  return formatMonth(props.month)
})

function getMonthsInRange(startStr, endStr) {
  const months = []
  try {
    let current = startOfMonth(parseISO(startStr))
    const end = startOfMonth(parseISO(endStr))

    // Safety break to prevent infinite loops
    let iterations = 0
    while ((isBefore(current, end) || current.getTime() === end.getTime()) && iterations < 36) {
      months.push(formatDate(current, 'yyyy-MM'))
      current = addMonths(current, 1)
      iterations++
    }
  } catch (e) {
    console.error('Error generating months range:', e)
  }
  return months
}

function formatTransactionDate(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    // Parse as ISO and format in local timezone
    const date = parseISO(dateStr.split('T')[0])
    return formatDate(date, 'MMM d, yyyy')
  } catch (e) {
    return dateStr
  }
}

function formatCurrency(amount) {
  if (amount == null) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`

    // If more than a week, show the actual date
    return formatDate(date, 'MMM d, yyyy h:mm a')
  } catch (e) {
    return dateStr
  }
}

function formatTransactionType(type) {
  const typeMap = {
    invoice: 'Invoice',
    journalEntry: 'Journal Entry',
    delayedCharge: 'Delayed Charge',
    monthlyRecurring: 'Monthly Recurring',
    wonUnscheduled: 'Won Unscheduled',
    weightedSales: 'Weighted Sales'
  }
  return typeMap[type] || type
}

function formatType(type) {
  const types = {
    invoice: 'Invoice',
    journalEntry: 'Journal Entry',
    delayedCharge: 'Delayed Charge',
    monthlyRecurring: 'Monthly Recurring',
    wonUnscheduled: 'Won Unscheduled',
    weightedSales: 'Weighted Sales'
  }
  return types[type] || type
}

function exportToCSV() {
  if (allTransactions.value.length === 0) return

  // Define headers
  const headers = ['Type', 'Doc #', 'Date', 'Client (Raw)', 'Client (Normalized)', 'Description', 'Amount']

  // Format rows
  const rows = allTransactions.value.map(txn => {
    return [
      formatType(txn.type),
      txn.docNumber || '',
      txn.date || '',
      `"${(txn.clientRaw || txn.customer || '').replace(/"/g, '""')}"`, // Quote and escape quotes
      `"${(txn.clientNormalized || txn.customer || '').replace(/"/g, '""')}"`,
      `"${(txn.description || '').replace(/"/g, '""')}"`,
      txn.amount || 0
    ].join(',')
  })

  // Combine headers and rows
  const csvContent = [headers.join(','), ...rows].join('\n')

  // Create blob and download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `transaction_details_${props.startDate || props.month}${props.endDate ? '_to_' + props.endDate : ''}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function getTypeColor(type) {
  const colors = {
    invoice: 'bg-blue-100 text-blue-800',
    journalEntry: 'bg-green-100 text-green-800',
    delayedCharge: 'bg-yellow-100 text-yellow-800',
    monthlyRecurring: 'bg-purple-100 text-purple-800',
    wonUnscheduled: 'bg-pink-100 text-pink-800',
    weightedSales: 'bg-gray-100 text-gray-800'
  }
  return colors[type] || 'bg-gray-100 text-gray-800'
}

function formatPercent(value, total) {
  if (total === 0) return '0%'
  return ((value / total) * 100).toFixed(1) + '%'
}

function formatPoints(value) {
  const points = value / pricePerPoint.value
  return points.toFixed(1)
}

function getClientColors() {
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b',
    '#06b6d4', '#84cc16', '#f97316', '#a855f7', '#14b8a6', '#6366f1',
    '#ef4444', '#22c55e', '#eab308', '#d946ef', '#0ea5e9', '#f43f5e'
  ]
  return colors
}

function createPieChart() {
  if (!pieCanvas.value || !clientData.value?.clients || clientData.value.clients.length === 0) return

  if (pieChartInstance) {
    pieChartInstance.destroy()
  }

  const ctx = pieCanvas.value.getContext('2d')
  const colors = getClientColors()
  const clients = sortedClients.value
  const total = clientTotalRevenue.value

  // Show top 10 clients individually, group the rest
  const mainClients = clients.slice(0, 10)
  const otherClients = clients.slice(10)

  // Add "Other Clients" if there are any
  if (otherClients.length > 0) {
    const otherTotal = otherClients.reduce((sum, c) => sum + c.total, 0)
    mainClients.push({
      client: `Other Clients (${otherClients.length})`,
      total: otherTotal
    })
  }

  pieChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: mainClients.map(c => c.client),
      datasets: [{
        data: mainClients.map(c => c.total),
        backgroundColor: mainClients.map((_, i) => colors[i % colors.length])
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: isDarkModeGlobal.value ? '#ffffff' : '#374151',
            padding: 10,
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || ''
              const value = formatCurrency(context.parsed)
              const percent = formatPercent(context.parsed, total)
              return `${label}: ${value} (${percent})`
            }
          }
        }
      }
    }
  })
}

// Watch for tab changes to create/destroy pie chart, save preference, and update URL
watch(activeTab, (newTab) => {
  // Save to localStorage for next time
  localStorage.setItem('transactionModal_lastTab', newTab)

  // Update URL query parameter
  const query = { ...route.query, modalTab: newTab }
  router.replace({ query })

  if (newTab === 'clients' && clientData.value?.clients) {
    setTimeout(() => createPieChart(), 100)
  } else if (pieChartInstance) {
    pieChartInstance.destroy()
    pieChartInstance = null
  }
})

// Load journal entry accounts
async function loadJournalEntryAccounts() {
  try {
    const response = await fetch('/.netlify/functions/journal-entry-accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to load journal entry accounts')
    }

    const data = await response.json()
    journalEntryAccounts.value = {
      revenue: data.data.revenueAccounts || [],
      unearned: data.data.unearnedRevenueAccounts || []
    }
  } catch (err) {
    console.error('Error loading journal entry accounts:', err)
  }
}

// Show create journal entry modal with prefilled data
async function createJournalEntryFromTransaction(transaction) {
  // Load accounts if not already loaded
  if (journalEntryAccounts.value.revenue.length === 0) {
    await loadJournalEntryAccounts()
  }

  // Extract invoice number from description if present
  const description = transaction.description || ''
  const invoiceMatch = description.match(/Invoice\s+(\d+)/i)
  const invoiceNumber = invoiceMatch ? invoiceMatch[1] : ''

  // Set prefill data
  journalEntryPrefillData.value = {
    clientName: transaction.customer || '',
    invoiceNumber: invoiceNumber,
    amount: transaction.amount || null,
    invoiceDate: transaction.date || ''
  }

  // Show modal
  showJournalEntryCreateModal.value = true
}

// Show edit journal entry modal
async function editJournalEntry(transaction) {
  // If we have an ID, use the bulk edit modal which also handles single entries
  if (transaction.id) {
    bulkEditEntryId.value = transaction.id
    showBulkEditModal.value = true
    return
  }

  // Fallback to searching (for legacy data or entries without ID)
  try {
    const response = await fetch(`/.netlify/functions/journal-entries-list?view=all`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to load journal entries')
    }

    const data = await response.json()

    // Find the journal entry by matching transaction data
    const entry = data.data.unpaired.find(e =>
      e.TxnDate === transaction.date &&
      Math.abs(parseFloat(e.Line?.[0]?.Amount || 0) - transaction.amount) < 0.01
    )

    if (entry) {
      bulkEditEntryId.value = entry.Id
      showBulkEditModal.value = true
    }
  } catch (err) {
    console.error('Error loading journal entry:', err)
  }
}

// Close journal entry create modal
function closeJournalEntryCreateModal() {
  showJournalEntryCreateModal.value = false
  journalEntryPrefillData.value = null
}

// Handle journal entry created
function handleJournalEntryCreated() {
  closeJournalEntryCreateModal()
  // Reload transactions
  loadAllData()
}

// Handle journal entry updated
function handleJournalEntryUpdated() {
  selectedJournalEntry.value = null
  // Reload transactions
  loadAllData()
}

// Handle journal entry deleted
function handleJournalEntryDeleted() {
  selectedJournalEntry.value = null
  // Reload transactions
  loadAllData()
}

// Watch for dark mode changes to update chart
watch(isDarkModeGlobal, () => {
  if (pieChartInstance && activeTab.value === 'clients') {
    createPieChart()
  }
})

// Watch for client filter changes to update chart
watch(clientEnabledTypes, () => {
  if (pieChartInstance && activeTab.value === 'clients') {
    createPieChart()
  }
}, { deep: true })

// Cleanup on unmount
onUnmounted(() => {
  if (pieChartInstance) {
    pieChartInstance.destroy()
    pieChartInstance = null
  }
})
</script>

<style scoped>
/* Remove card transitions since we're using table rows */
</style>
