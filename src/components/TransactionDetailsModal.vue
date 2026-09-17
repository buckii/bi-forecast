<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-7xl mx-4 max-h-screen overflow-y-auto">
      <div class="flex items-center justify-between mb-4">
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ modalTitle }}</h3>
          <!-- Cache/Fetch Info with Refresh Button -->
          <div
            v-if="activeTab === 'transactions' && cacheMetadata.transactionsCachedAt"
            class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"
          >
            <span v-if="cacheMetadata.transactionsFromCache">
              Cached {{ formatRelativeTime(cacheMetadata.transactionsCachedAt) }}
            </span>
            <span v-else> Fetched {{ formatRelativeTime(cacheMetadata.transactionsCachedAt) }} </span>
            <button
              @click="refreshData"
              :disabled="refreshing || loading"
              class="p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data"
            >
              <svg
                class="w-3.5 h-3.5"
                :class="{ 'animate-spin': refreshing }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
          <div
            v-if="activeTab === 'clients' && cacheMetadata.clientsCachedAt"
            class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"
          >
            <span v-if="cacheMetadata.clientsFromCache">
              Cached {{ formatRelativeTime(cacheMetadata.clientsCachedAt) }}
            </span>
            <span v-else> Fetched {{ formatRelativeTime(cacheMetadata.clientsCachedAt) }} </span>
            <button
              @click="refreshData"
              :disabled="refreshing || loading"
              class="p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh data"
            >
              <svg
                class="w-3.5 h-3.5"
                :class="{ 'animate-spin': refreshing }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button
            @click="exportToCSV"
            class="hidden sm:inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
            :disabled="loading || allTransactions.length === 0"
            title="Export list to CSV"
          >
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
          <span class="text-xs font-semibold text-blue-700 dark:text-blue-300">{{
            loadingStatus || 'Loading...'
          }}</span>
          <span class="text-xs font-semibold text-blue-700 dark:text-blue-300">{{ loadingProgress }}%</span>
        </div>
        <div class="w-full bg-blue-200 dark:bg-blue-800/40 rounded-full h-1.5">
          <div
            class="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
            :style="{ width: loadingProgress + '%' }"
          ></div>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="-mb-px flex space-x-8">
          <button
            @click="activeTab = 'transactions'"
            :class="[
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === 'transactions'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
            ]"
          >
            Transactions
          </button>
          <button
            @click="activeTab = 'clients'"
            :class="[
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === 'clients'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
            ]"
          >
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
            <button
              @click="toggleAllFilters"
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium w-20 text-left"
            >
              {{ allFiltersEnabled ? 'Hide All' : 'Show All' }}
            </button>
            <div class="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
            <label
              v-for="type in transactionTypes"
              :key="type.value"
              class="flex items-center space-x-2 cursor-pointer"
            >
              <input
                type="checkbox"
                v-model="enabledTypes[type.value]"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ type.label }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">({{ getTypeCount(type.value) }})</span>
            </label>
          </div>

          <!-- Sort Options -->
          <div class="flex items-center space-x-4 text-sm">
            <span class="text-gray-500 dark:text-gray-400">Sort by:</span>
            <button
              @click="toggleSort('amount')"
              :class="[
                'hover:underline font-medium',
                sortBy === 'amount' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-300',
              ]"
            >
              Amount {{ sortBy === 'amount' ? (sortDirection === 'desc' ? '↓' : '↑') : '' }}
            </button>
            <button
              @click="toggleSort('date')"
              :class="[
                'hover:underline font-medium',
                sortBy === 'date' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-300',
              ]"
            >
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
                <tr
                  @click="transaction.type !== 'delayedCharge' ? toggleDetails(transaction.id) : null"
                  :class="[
                    transaction.type !== 'delayedCharge'
                      ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'
                      : '',
                    'transition-colors',
                    transaction.description?.toLowerCase().includes('annual') ? 'opacity-60' : '',
                  ]"
                >
                  <td class="px-3 py-3">
                    <div class="flex items-center">
                      <svg
                        v-if="transaction.type !== 'delayedCharge'"
                        class="w-4 h-4 text-gray-400 mr-2 transform transition-transform duration-200"
                        :class="{ 'rotate-90': expandedTransactions.has(transaction.id) }"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                      </svg>
                      <span
                        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                        :class="[
                          transactionTypeColor(transaction.type),
                          transaction.type === 'delayedCharge' ? '' : 'ml-0',
                        ]"
                        :style="transaction.type === 'delayedCharge' ? 'margin-left: 24px' : ''"
                      >
                        {{ transactionTypeLabel(transaction.type) }}
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
                    <button
                      v-if="transaction.type === 'invoice' || transaction.type === 'delayedCharge'"
                      @click.stop="createJournalEntryFromTransaction(transaction)"
                      class="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                      title="Create Journal Entry"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    <button
                      v-if="transaction.type === 'journalEntry'"
                      @click.stop="editJournalEntry(transaction)"
                      class="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Edit Journal Entry"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
                <tr
                  v-if="transaction.type !== 'delayedCharge' && expandedTransactions.has(transaction.id)"
                  class="bg-gray-50 dark:bg-gray-700"
                >
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
            <button
              @click="toggleAllClientFilters"
              class="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium w-20 text-left"
            >
              {{ allClientFiltersEnabled ? 'Hide All' : 'Show All' }}
            </button>
            <div class="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
            <label
              v-for="type in transactionTypes"
              :key="type.value"
              class="flex items-center space-x-2 cursor-pointer"
            >
              <input
                type="checkbox"
                v-model="clientEnabledTypes[type.value]"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ type.label }}</span>
            </label>
          </div>

          <!-- Sort Options -->
          <div class="flex items-center space-x-4 text-sm">
            <span class="text-gray-500 dark:text-gray-400">Sort by:</span>
            <button
              @click="toggleClientSort('amount')"
              :class="[
                'hover:underline font-medium',
                clientSortBy === 'amount'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-300',
              ]"
            >
              Amount {{ clientSortBy === 'amount' ? (clientSortDirection === 'desc' ? '↓' : '↑') : '' }}
            </button>
            <button
              @click="toggleClientSort('client')"
              :class="[
                'hover:underline font-medium',
                clientSortBy === 'client'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-300',
              ]"
            >
              Client (alpha) {{ clientSortBy === 'client' ? (clientSortDirection === 'desc' ? '↓' : '↑') : '' }}
            </button>
          </div>
        </div>

        <!-- Pie Chart -->
        <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div class="flex items-start justify-between gap-3 mb-4">
            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Revenue by Client</h4>
            <div class="flex flex-col items-end gap-1">
              <button
                @click="shareClientsToSlack"
                :disabled="sharingToSlack || !sortedClients.length"
                class="btn-secondary inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  v-if="sharingToSlack"
                  class="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <svg v-else class="-ml-1 mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 10.12h6.481v2.522H5.042a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 7.597h6.481V5.074c0-1.393 1.135-2.523 2.52-2.523a2.528 2.528 0 0 1 2.52 2.523v2.523h2.515c1.393 0 2.52 1.135 2.52 2.523a2.528 2.528 0 0 1-2.52 2.523h-2.515v2.522h2.515a2.528 2.528 0 0 1 2.52 2.523A2.528 2.528 0 0 1 16.558 18.88h-2.515v2.523c0 1.393-1.135 2.523-2.52 2.523a2.528 2.528 0 0 1-2.52-2.523V18.88H5.042a2.528 2.528 0 0 1-2.52-2.523A2.528 2.528 0 0 1 5.042 15.835h6.481v-2.522H5.042z"
                  />
                </svg>
                {{ sharingToSlack ? 'Sending...' : 'Send to Slack' }}
              </button>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ sharedClientCount }} {{ sharedClientCount === 1 ? 'client' : 'clients' }}
                {{ formatCurrency(shareThreshold) }}+, rest rolled up
              </p>
            </div>
          </div>
          <div style="height: 300px">
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
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Client Name
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Revenue
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Approx. Points
                  </th>
                  <th
                    scope="col"
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                <template v-for="client in sortedClients" :key="client.client">
                  <tr
                    @click="toggleClient(client.client)"
                    class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      <div class="flex items-center">
                        <svg
                          class="w-4 h-4 text-gray-400 mr-2 transform transition-transform duration-200"
                          :class="{ 'rotate-90': expandedClients.has(client.client) }"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
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
                      {{ formatShare(client.total, clientTotalRevenue) }}
                    </td>
                  </tr>

                  <!-- Expanded Transactions for Client -->
                  <tr v-if="expandedClients.has(client.client)" class="bg-gray-50 dark:bg-gray-800">
                    <td colspan="4" class="px-6 py-4">
                      <div class="space-y-2">
                        <div
                          v-if="getClientTransactions(client.client).length === 0"
                          class="text-sm text-gray-500 dark:text-gray-400"
                        >
                          No transactions found
                        </div>
                        <div v-else class="space-y-1">
                          <div
                            v-for="transaction in getClientTransactions(client.client)"
                            :key="transaction.id"
                            class="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs"
                          >
                            <div class="flex items-center space-x-3 flex-1">
                              <span
                                class="inline-flex items-center px-2 py-1 rounded-full font-medium"
                                :class="transactionTypeColor(transaction.type)"
                              >
                                {{ transactionTypeLabel(transaction.type) }}
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
                                <button
                                  v-if="transaction.type === 'invoice' || transaction.type === 'delayedCharge'"
                                  @click.stop="createJournalEntryFromTransaction(transaction)"
                                  class="inline-flex ml-1 p-1 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors align-middle"
                                  title="Create Journal Entry"
                                >
                                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M12 4v16m8-8H4"
                                    />
                                  </svg>
                                </button>
                                <button
                                  v-if="transaction.type === 'journalEntry'"
                                  @click.stop="editJournalEntry(transaction)"
                                  class="inline-flex ml-1 p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors align-middle"
                                  title="Edit Journal Entry"
                                >
                                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
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
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">Total</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                    {{ formatCurrency(clientTotalRevenue) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600 dark:text-gray-300">
                    {{ formatPoints(clientTotalRevenue) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-3 mt-6 pt-4 border-t">
        <button
          @click="exportToCSV"
          class="hidden sm:inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
          :disabled="loading"
        >
          <ArrowDownTrayIcon class="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400" />
          Export Detail
        </button>
        <button @click="closeModal" class="btn-secondary">Close</button>
      </div>
    </div>

    <!-- Journal Entry Create Modal -->
    <JournalEntryCreateModal
      v-if="showJournalEntryCreateModal"
      :revenueAccounts="journalEntryAccounts.revenue"
      :unearnedAccounts="journalEntryAccounts.unearned"
      :prefillData="journalEntryPrefillData"
      @close="closeJournalEntryCreateModal"
      @created="handleJournalEntryCreated"
    />

    <!-- Journal Entry Detail/Edit Modal -->
    <JournalEntryDetailModal
      v-if="selectedJournalEntry"
      :entry="selectedJournalEntry"
      @close="selectedJournalEntry = null"
      @updated="handleJournalEntryUpdated"
      @delete="handleJournalEntryDeleted"
    />

    <!-- Journal Entry Bulk Edit Modal -->
    <JournalEntryBulkEditModal
      v-if="showBulkEditModal"
      :initialEntryId="bulkEditEntryId"
      @close="showBulkEditModal = false"
      @updated="handleJournalEntryUpdated"
    />

    <!-- Slack share status -->
    <StatusModal
      :show="showShareModal"
      :state="shareModalState"
      loading-title="Sharing to Slack..."
      loading-message="Posting the client breakdown and attaching the chart."
      success-title="Shared to Slack"
      :success-message="shareSuccessMessage"
      error-title="Share Failed"
      :error-message="shareModalError"
      :error-details="shareModalErrorDetails"
      @close="closeShareModal"
      @retry="shareClientsToSlack"
    />
  </div>
</template>

<script setup>
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { format as formatDate, parseISO } from 'date-fns'
import { computed, onUnmounted, ref, watch } from 'vue'
import { formatCurrency, formatShare } from '../lib/format.js'
import { TRANSACTION_TYPES, transactionTypeColor, transactionTypeLabel } from '../lib/transaction-types.js'
import { useRoute, useRouter } from 'vue-router'
import { isDarkModeGlobal } from '../composables/useDarkMode'
import { useAuthStore } from '../stores/auth'
import { useRevenueStore } from '../stores/revenue'
import { useTransactionDetails } from '../composables/useTransactionDetails.js'
import { sortClients, sortTransactions, useTypeFilter } from '../composables/useTypeFilter.js'
import { useClientPieChart } from '../composables/useClientPieChart.js'
import { useClientRevenueShare } from '../composables/useClientRevenueShare.js'
import { useJournalEntryActions } from '../composables/useJournalEntryActions.js'
import JournalEntryBulkEditModal from './JournalEntryBulkEditModal.vue'
import JournalEntryCreateModal from './JournalEntryCreateModal.vue'
import JournalEntryDetailModal from './JournalEntryDetailModal.vue'
import StatusModal from './StatusModal.vue'

const revenueStore = useRevenueStore()
const router = useRouter()
const route = useRoute()

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  month: {
    type: String,
    default: '',
  },
  asOf: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: '',
  },
  startDate: {
    type: String,
    default: '',
  },
  endDate: {
    type: String,
    default: '',
  },
  autoExport: {
    type: Boolean,
    default: false,
  },
  // Clients below this are rolled up into a single line when sharing to Slack
  shareThreshold: {
    type: Number,
    default: 3000,
  },
})

const emit = defineEmits(['close'])

const authStore = useAuthStore()

const { loading, loadingProgress, loadingStatus, error, allTransactions, clientData, cacheMetadata, loadAllData } =
  useTransactionDetails(props)

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
watch(loading, (newLoading) => {
  if (!newLoading && props.isOpen && props.autoExport && allTransactions.value.length > 0) {
    setTimeout(() => {
      exportToCSV()
    }, 500)
  }
})
const refreshing = ref(false)
const expandedTransactions = ref(new Set())
const expandedClients = ref(new Set())
const pieCanvas = ref(null)

const {
  draw: createPieChart,
  destroy: destroyPieChart,
  toImage: pieChartImage,
  hasChart: hasPieChart,
} = useClientPieChart({ canvas: pieCanvas, clients: sortedClients, total: clientTotalRevenue })

const {
  sharingToSlack,
  showShareModal,
  shareModalState,
  shareModalError,
  shareModalErrorDetails,
  shareSuccessMessage,
  shareClientsToSlack,
  closeShareModal,
} = useClientRevenueShare({ props, clients: sortedClients, pieChartImage })

const {
  showJournalEntryCreateModal,
  journalEntryPrefillData,
  selectedJournalEntry,
  showBulkEditModal,
  bulkEditEntryId,
  journalEntryAccounts,
  loadJournalEntryAccounts,
  createJournalEntryFromTransaction,
  editJournalEntry,
  closeJournalEntryCreateModal,
  handleJournalEntryCreated,
  handleJournalEntryUpdated,
  handleJournalEntryDeleted,
} = useJournalEntryActions(() => loadDetails())

const sharedClientCount = computed(
  () => sortedClients.value.filter((c) => (c.total || 0) >= props.shareThreshold).length,
)

// Journal Entry Modal State
const {
  enabledTypes,
  sortBy,
  sortDirection,
  allEnabled: allFiltersEnabled,
  toggleAll: toggleAllFilters,
  toggleSort,
} = useTypeFilter(revenueStore.includeWeightedSales)

const {
  enabledTypes: clientEnabledTypes,
  sortBy: clientSortBy,
  sortDirection: clientSortDirection,
  allEnabled: allClientFiltersEnabled,
  toggleAll: toggleAllClientFilters,
  toggleSort: toggleClientSort,
} = useTypeFilter(revenueStore.includeWeightedSales)

const filteredTransactions = computed(() => {
  const enabled = (allTransactions.value || []).filter((t) => enabledTypes.value[t.type])
  return sortTransactions(enabled, sortBy.value, sortDirection.value)
})

const filteredTotalAmount = computed(() => {
  return filteredTransactions.value.reduce((sum, t) => sum + (t.amount || 0), 0)
})

const sortedClients = computed(() => {
  if (!clientData.value?.clients) return []

  // Totals are recomputed from the transactions so they honour this tab's type filters.
  const totals = new Map()
  for (const transaction of allTransactions.value.filter((t) => clientEnabledTypes.value[t.type])) {
    totals.set(transaction.customer, (totals.get(transaction.customer) || 0) + (transaction.amount || 0))
  }

  const clients = [...totals].map(([client, total]) => ({ client, total }))
  return sortClients(clients, clientSortBy.value, clientSortDirection.value)
})

const clientTotalRevenue = computed(() => {
  return sortedClients.value.reduce((sum, c) => sum + c.total, 0)
})

function getClientTransactions(clientName) {
  if (!allTransactions.value) return []

  // Filter transactions by client name and enabled types
  const transactions = allTransactions.value
    .filter((t) => t.customer === clientName && clientEnabledTypes.value[t.type])
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return transactions
}

function getTypeCount(type) {
  if (!allTransactions.value) return 0
  return allTransactions.value.filter((t) => t.type === type).length
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen && (props.month || (props.startDate && props.endDate))) {
      loadDetails()
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
      destroyPieChart()
    }
  },
  { immediate: true },
)

// Sync weighted sales filter with dashboard toggle and reload data
watch(
  () => revenueStore.includeWeightedSales,
  (newValue) => {
    enabledTypes.value.weightedSales = newValue
    clientEnabledTypes.value.weightedSales = newValue

    // Reload data if modal is open to fetch/exclude weighted sales transactions
    if (props.isOpen && (props.month || (props.startDate && props.endDate))) {
      loadDetails()
    }
  },
)

async function loadDetails(forceRefresh = false) {
  await loadAllData(forceRefresh)

  if (activeTab.value === 'clients' && clientData.value?.clients) {
    setTimeout(() => createPieChart(), 100)
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
    await loadDetails(true)
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

function exportToCSV() {
  if (allTransactions.value.length === 0) return

  // Define headers
  const headers = ['Type', 'Doc #', 'Date', 'Client (Raw)', 'Client (Normalized)', 'Description', 'Amount']

  // Format rows
  const rows = allTransactions.value.map((txn) => {
    return [
      transactionTypeLabel(txn.type),
      txn.docNumber || '',
      txn.date || '',
      `"${(txn.clientRaw || txn.customer || '').replace(/"/g, '""')}"`, // Quote and escape quotes
      `"${(txn.clientNormalized || txn.customer || '').replace(/"/g, '""')}"`,
      `"${(txn.description || '').replace(/"/g, '""')}"`,
      txn.amount || 0,
    ].join(',')
  })

  // Combine headers and rows
  const csvContent = [headers.join(','), ...rows].join('\n')

  // Create blob and download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    `transaction_details_${props.startDate || props.month}${props.endDate ? '_to_' + props.endDate : ''}.csv`,
  )
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function formatPoints(value) {
  const points = value / pricePerPoint.value
  return points.toFixed(1)
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
  } else {
    destroyPieChart()
  }
})

// Load journal entry accounts
// Watch for dark mode changes to update chart
watch(isDarkModeGlobal, () => {
  if (hasPieChart.value && activeTab.value === 'clients') {
    createPieChart()
  }
})

// Watch for client filter changes to update chart
watch(
  clientEnabledTypes,
  () => {
    if (hasPieChart.value && activeTab.value === 'clients') {
      createPieChart()
    }
  },
  { deep: true },
)

// Cleanup on unmount
onUnmounted(() => {
  destroyPieChart()
})
</script>

<style scoped>
/* Remove card transitions since we're using table rows */
</style>
