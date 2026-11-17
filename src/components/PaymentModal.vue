<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div @click="close" class="fixed inset-0 bg-black bg-opacity-50"></div>

        <!-- Modal -->
        <div
          class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
        >
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {{ invoice ? 'Record Payment' : 'Receive Payment' }}
          </h2>

          <div class="space-y-4">
            <!-- Invoice Details -->
            <div v-if="invoice" class="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <p class="text-sm text-gray-600 dark:text-gray-400">Invoice #{{ invoice.docNumber }}</p>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ invoice.customerName }}</p>
              <p class="text-lg font-bold text-primary-600 mt-1">{{ formatCurrency(invoice.balance) }}</p>
            </div>

            <!-- Client search and open invoices -->
            <div v-else>
              <label
                for="payment-client-search"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Client
              </label>
              <input
                id="payment-client-search"
                ref="searchInput"
                v-model="search"
                type="search"
                autocomplete="off"
                placeholder="Type part of a client name"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />

              <fieldset class="mt-3">
                <legend class="sr-only">Invoices to apply this payment to</legend>
                <ul
                  v-if="matchingInvoices.length"
                  class="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md divide-y divide-gray-200 dark:divide-gray-600"
                >
                  <li v-for="openInvoice in matchingInvoices" :key="openInvoice.id">
                    <label
                      class="flex items-center gap-3 px-3 py-2"
                      :class="isOtherCustomer(openInvoice) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'"
                    >
                      <input
                        v-model="selectedIds"
                        type="checkbox"
                        :value="openInvoice.id"
                        :disabled="isOtherCustomer(openInvoice)"
                        class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span class="flex-1 min-w-0">
                        <span class="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {{ openInvoice.customerName }}
                        </span>
                        <span class="block text-xs text-gray-500 dark:text-gray-400">
                          #{{ openInvoice.docNumber }} · {{ formatDate(openInvoice.txnDate) }}
                        </span>
                      </span>
                      <span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {{ formatCurrency(openInvoice.balance) }}
                      </span>
                    </label>
                  </li>
                </ul>
                <p v-else class="text-sm text-gray-500 dark:text-gray-400">No open invoices match "{{ search }}"</p>
              </fieldset>
            </div>

            <!-- Payment Amount -->
            <div>
              <label for="payment-amount" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Amount
              </label>
              <input
                id="payment-amount"
                type="number"
                v-model.number="paymentAmount"
                :max="selectedTotal"
                step="0.01"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <!-- Payment Method -->
            <div>
              <label for="payment-method" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Method
              </label>
              <select
                id="payment-method"
                v-model="paymentMethod"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="check">Check</option>
                <option value="ach">ACH/Wire</option>
                <option value="credit_card">Credit Card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>

            <!-- Payment Date -->
            <div>
              <label for="payment-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Date
              </label>
              <input
                id="payment-date"
                type="date"
                v-model="paymentDate"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <!-- Actions -->
            <div class="flex justify-end space-x-3 pt-4">
              <button
                @click="close"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                @click="confirm"
                :disabled="!isValid || processing"
                class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <div
                  v-if="processing"
                  class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                ></div>
                <span>{{ processing ? 'Processing...' : 'Record Payment' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { format } from 'date-fns'
import { computed, nextTick, ref, watch } from 'vue'
import { formatCurrencyCents as formatCurrency, formatDate } from '../lib/format.js'
import { allocatePayment, sumBalances } from '../lib/payment-allocation.js'

const DEFAULT_PAYMENT_METHOD = 'check'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  // A single invoice to pay; without one the modal searches `openInvoices` by client
  invoice: {
    type: Object,
    default: null,
  },
  openInvoices: {
    type: Array,
    default: () => [],
  },
  processing: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'confirm'])

const search = ref('')
const selectedIds = ref([])
const paymentAmount = ref(0)
const paymentMethod = ref(DEFAULT_PAYMENT_METHOD)
const paymentDate = ref(today())
const searchInput = ref(null)

const oldestFirst = computed(() =>
  [...props.openInvoices].sort((a, b) => (a.txnDate || '').localeCompare(b.txnDate || '')),
)

const matchingInvoices = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return oldestFirst.value
  return oldestFirst.value.filter((openInvoice) => openInvoice.customerName?.toLowerCase().includes(term))
})

const selectedInvoices = computed(() => {
  if (props.invoice) return [props.invoice]
  return oldestFirst.value.filter((openInvoice) => selectedIds.value.includes(openInvoice.id))
})

const selectedCustomerId = computed(() => selectedInvoices.value[0]?.customerId)
const selectedTotal = computed(() => sumBalances(selectedInvoices.value))

const isValid = computed(
  () =>
    selectedInvoices.value.length > 0 &&
    paymentAmount.value > 0 &&
    paymentAmount.value <= selectedTotal.value &&
    paymentMethod.value &&
    paymentDate.value,
)

// One QuickBooks payment belongs to one customer
function isOtherCustomer(openInvoice) {
  return Boolean(selectedCustomerId.value) && openInvoice.customerId !== selectedCustomerId.value
}

function today() {
  return format(new Date(), 'yyyy-MM-dd')
}

watch(search, () => {
  const term = search.value.trim()
  const oldestMatch = term ? matchingInvoices.value[0] : null
  selectedIds.value = oldestMatch ? [oldestMatch.id] : []
})

watch(selectedTotal, (total) => {
  paymentAmount.value = total
})

watch(
  () => props.isOpen,
  async (isOpen) => {
    if (!isOpen) return
    search.value = ''
    selectedIds.value = []
    paymentAmount.value = selectedTotal.value
    paymentMethod.value = DEFAULT_PAYMENT_METHOD
    paymentDate.value = today()

    if (!props.invoice) {
      await nextTick()
      searchInput.value?.focus()
    }
  },
)

function close() {
  emit('close')
}

function confirm() {
  if (!isValid.value || props.processing) return

  emit('confirm', {
    customerId: selectedCustomerId.value,
    amount: paymentAmount.value,
    paymentMethod: paymentMethod.value,
    paymentDate: paymentDate.value,
    lines: allocatePayment(selectedInvoices.value, paymentAmount.value),
  })
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.3s;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.9);
}
</style>
