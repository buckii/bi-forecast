<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div @click="close" class="fixed inset-0 bg-black bg-opacity-50"></div>
        
        <!-- Modal -->
        <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Record Payment</h2>
          
          <div v-if="invoice" class="space-y-4">
            <!-- Invoice Details -->
            <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <p class="text-sm text-gray-600 dark:text-gray-400">Invoice #{{ invoice.docNumber }}</p>
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ invoice.customerName }}</p>
              <p class="text-lg font-bold text-primary-600 mt-1">{{ formatCurrency(invoice.balance) }}</p>
            </div>
            
            <!-- Payment Amount -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Amount
              </label>
              <input
                type="number"
                v-model.number="paymentAmount"
                :max="invoice.balance"
                step="0.01"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            <!-- Payment Method -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Method
              </label>
              <select
                v-model="paymentMethod"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Select payment method</option>
                <option value="check">Check</option>
                <option value="ach">ACH/Wire</option>
                <option value="credit_card">Credit Card</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <!-- Payment Date -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Date
              </label>
              <input
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
                <div v-if="processing" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
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
import { ref, computed, watch } from 'vue'
import { format } from 'date-fns'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  invoice: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'confirm'])

const paymentAmount = ref(0)
const paymentMethod = ref('')
const paymentDate = ref(format(new Date(), 'yyyy-MM-dd'))
const processing = ref(false)

const isValid = computed(() => {
  return paymentAmount.value > 0 && 
         paymentAmount.value <= (props.invoice?.balance || 0) &&
         paymentMethod.value &&
         paymentDate.value
})

watch(() => props.invoice, (newInvoice) => {
  if (newInvoice) {
    paymentAmount.value = newInvoice.balance || 0
    paymentMethod.value = ''
    paymentDate.value = format(new Date(), 'yyyy-MM-dd')
  }
})

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0)
}

function close() {
  emit('close')
}

async function confirm() {
  if (!isValid.value) return
  
  processing.value = true
  try {
    await emit('confirm', {
      invoiceId: props.invoice.id,
      customerId: props.invoice.customerId,
      amount: paymentAmount.value,
      paymentMethod: paymentMethod.value,
      paymentDate: paymentDate.value
    })
  } finally {
    processing.value = false
  }
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