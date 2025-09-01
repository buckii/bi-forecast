<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="close"></div>
    
    <!-- Modal -->
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="relative w-full max-w-md rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
        
        <!-- Success State -->
        <div v-if="state === 'success'" class="text-center">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <svg class="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">{{ successTitle || 'Success!' }}</h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ successMessage || 'The operation completed successfully.' }}
          </p>
          <button @click="close" class="mt-4 btn-primary">
            {{ successButtonText || 'Done' }}
          </button>
        </div>
        
        <!-- Loading State -->
        <div v-else-if="state === 'loading'" class="text-center">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <svg class="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">{{ loadingTitle || 'Processing...' }}</h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ loadingMessage || 'Please wait while we process your request.' }}
          </p>
        </div>
        
        <!-- Error State -->
        <div v-else-if="state === 'error'" class="text-center">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <svg class="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">{{ errorTitle || 'Error Occurred' }}</h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ errorMessage || 'Something went wrong. Please try again.' }}
          </p>
          
          <!-- Error Details (collapsible) -->
          <div v-if="errorDetails" class="mt-4">
            <button 
              @click="showErrorDetails = !showErrorDetails"
              class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {{ showErrorDetails ? 'Hide' : 'Show' }} technical details
            </button>
            <div v-if="showErrorDetails" class="mt-2 rounded bg-gray-50 dark:bg-gray-900 p-3 text-left">
              <pre class="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{{ errorDetails }}</pre>
            </div>
          </div>
          
          <div class="mt-6 flex space-x-3">
            <button v-if="showRetryButton" @click="retry" class="btn-primary flex-1">
              {{ retryButtonText || 'Try Again' }}
            </button>
            <button @click="close" class="btn-secondary" :class="{ 'flex-1': showRetryButton }">
              Close
            </button>
          </div>
        </div>
        
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  state: {
    type: String,
    default: 'loading', // 'loading', 'success', 'error'
    validator: (value) => ['loading', 'success', 'error'].includes(value)
  },
  // Loading state props
  loadingTitle: {
    type: String,
    default: ''
  },
  loadingMessage: {
    type: String,
    default: ''
  },
  // Success state props
  successTitle: {
    type: String,
    default: ''
  },
  successMessage: {
    type: String,
    default: ''
  },
  successButtonText: {
    type: String,
    default: ''
  },
  // Error state props
  errorTitle: {
    type: String,
    default: ''
  },
  errorMessage: {
    type: String,
    default: ''
  },
  errorDetails: {
    type: String,
    default: ''
  },
  showRetryButton: {
    type: Boolean,
    default: true
  },
  retryButtonText: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'retry'])

const showErrorDetails = ref(false)

function close() {
  showErrorDetails.value = false
  emit('close')
}

function retry() {
  showErrorDetails.value = false
  emit('retry')
}
</script>