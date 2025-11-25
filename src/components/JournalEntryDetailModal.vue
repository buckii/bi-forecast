<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b dark:border-gray-700">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Journal Entry Details</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">QuickBooks ID: {{ entry.Id }}</p>
        </div>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Entry Metadata -->
        <div class="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div>
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Transaction Date</div>
            <div class="text-sm text-gray-900 dark:text-gray-100 mt-1">{{ formatDate(entry.TxnDate) }}</div>
          </div>
          <div>
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Doc Number</div>
            <div class="text-sm text-gray-900 dark:text-gray-100 mt-1">{{ entry.DocNumber || 'N/A' }}</div>
          </div>
          <div class="col-span-2" v-if="entry.PrivateNote">
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Private Note</div>
            <div class="text-sm text-gray-900 dark:text-gray-100 mt-1">{{ entry.PrivateNote }}</div>
          </div>
        </div>

        <!-- Line Items -->
        <div class="mb-6">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 uppercase">Line Items</h4>
          <div class="space-y-3">
            <div
              v-for="(line, index) in entry.Line"
              :key="index"
              class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                  <div class="flex items-center space-x-2">
                    <span
                      :class="[
                        'px-2 py-1 text-xs font-semibold rounded',
                        line.JournalEntryLineDetail.PostingType === 'Debit'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      ]"
                    >
                      {{ line.JournalEntryLineDetail.PostingType }}
                    </span>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {{ line.JournalEntryLineDetail.AccountRef.name }}
                    </span>
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Account #{{ line.JournalEntryLineDetail.AccountRef.value }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {{ formatCurrency(line.Amount) }}
                  </div>
                </div>
              </div>
              <div v-if="line.Description" class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {{ line.Description }}
              </div>
              <div v-if="line.JournalEntryLineDetail.Entity" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Customer: {{ line.JournalEntryLineDetail.Entity.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- Totals -->
        <div class="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Debits</div>
              <div class="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                {{ formatCurrency(totalDebits) }}
              </div>
            </div>
            <div>
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Credits</div>
              <div class="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                {{ formatCurrency(totalCredits) }}
              </div>
            </div>
            <div class="col-span-2">
              <div class="flex items-center space-x-2">
                <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balanced</div>
                <span
                  v-if="isBalanced"
                  class="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                >
                  ✓ Yes
                </span>
                <span
                  v-else
                  class="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                >
                  ✗ No
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Revenue Impact -->
        <div v-if="revenueImpact" class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Revenue Impact</div>
          <div class="text-sm text-blue-800 dark:text-blue-200">
            {{ revenueImpact.description }}
          </div>
        </div>

        <!-- Metadata -->
        <div class="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-gray-500 dark:text-gray-400">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="font-medium">Created:</span>
              {{ formatDateTime(entry.MetaData?.CreateTime) }}
            </div>
            <div>
              <span class="font-medium">Last Updated:</span>
              {{ formatDateTime(entry.MetaData?.LastUpdatedTime) }}
            </div>
            <div>
              <span class="font-medium">Sync Token:</span>
              {{ entry.SyncToken }}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-6 border-t dark:border-gray-700">
        <a
          :href="`https://app.qbo.intuit.com/app/journal?txnId=${entry.Id}`"
          target="_blank"
          class="text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 flex items-center space-x-1"
        >
          <span>View in QuickBooks</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <div class="flex space-x-3">
          <button
            @click="$emit('delete', entry.Id)"
            class="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete Entry
          </button>
          <button @click="$emit('close')" class="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  entry: {
    type: Object,
    required: true
  }
})

defineEmits(['close', 'delete'])

const totalDebits = computed(() => {
  return props.entry.Line?.reduce((sum, line) => {
    if (line.JournalEntryLineDetail?.PostingType === 'Debit') {
      return sum + (line.Amount || 0)
    }
    return sum
  }, 0) || 0
})

const totalCredits = computed(() => {
  return props.entry.Line?.reduce((sum, line) => {
    if (line.JournalEntryLineDetail?.PostingType === 'Credit') {
      return sum + (line.Amount || 0)
    }
    return sum
  }, 0) || 0
})

const isBalanced = computed(() => {
  return Math.abs(totalDebits.value - totalCredits.value) < 0.01
})

const revenueImpact = computed(() => {
  // Find unearned revenue line
  const unearnedLine = props.entry.Line?.find(line => {
    const accountName = line.JournalEntryLineDetail?.AccountRef?.name?.toLowerCase() || ''
    return accountName.includes('unearned') || accountName.includes('deferred')
  })

  if (!unearnedLine) return null

  const month = new Date(props.entry.TxnDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  const amount = unearnedLine.Amount
  const isDebit = unearnedLine.JournalEntryLineDetail.PostingType === 'Debit'

  return {
    description: `${month}: ${isDebit ? '+' : '-'}${formatCurrency(amount)} (${isDebit ? 'Recognizes' : 'Defers'} revenue)`
  }
})

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value)
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}
</script>
