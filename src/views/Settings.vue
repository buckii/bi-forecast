<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">Settings</h1>
      
      <!-- Company Information -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Company Name</label>
            <p class="mt-1 text-sm text-gray-900">{{ company?.name || 'N/A' }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Domain</label>
            <p class="mt-1 text-sm text-gray-900">{{ company?.domain || 'N/A' }}</p>
          </div>
        </div>
      </div>
      
      <!-- API Connections -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">API Connections</h2>
        <div class="space-y-4">
          <!-- QuickBooks Online -->
          <div class="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 class="font-medium text-gray-900">QuickBooks Online</h3>
              <p class="text-sm text-gray-500">Connect to sync invoices, journal entries, and delayed charges</p>
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
          <div class="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 class="font-medium text-gray-900">Pipedrive</h3>
              <p class="text-sm text-gray-500">Connect to sync deals and pipeline data</p>
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
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Data Management</h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900">Archive Retention</h3>
              <p class="text-sm text-gray-500">Number of days to keep historical data</p>
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
        </div>
      </div>
    </div>
    
    <!-- Pipedrive Modal -->
    <div v-if="showPipedriveModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Pipedrive API Key</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">API Token</label>
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
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import AppLayout from '../components/AppLayout.vue'

const authStore = useAuthStore()

const showPipedriveModal = ref(false)
const pipedriveApiKey = ref('')
const archiveRetentionDays = ref(365)
const refreshing = ref(false)
const lastRefresh = ref(null)

const qboConnected = ref(false)
const pipedriveConnected = ref(false)

const company = computed(() => authStore.company)

function connectQBO() {
  // This would redirect to QBO OAuth flow
  console.log('Connect to QuickBooks Online')
}

function disconnectQBO() {
  // This would disconnect QBO
  console.log('Disconnect QuickBooks Online')
}

function savePipedriveKey() {
  // This would save the API key
  console.log('Save Pipedrive key:', pipedriveApiKey.value)
  showPipedriveModal.value = false
  pipedriveConnected.value = true
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

onMounted(() => {
  // Load current settings
  lastRefresh.value = 'Today at 3:00 AM'
})
</script>