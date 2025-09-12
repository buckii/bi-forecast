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
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
            <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ company?.name || 'N/A' }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Domain</label>
            <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ company?.domain || 'N/A' }}</p>
          </div>
        </div>
        
        <div v-else class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
            <input
              type="text"
              v-model="editableCompanyName"
              class="input mt-1"
              placeholder="Enter company name"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Domain</label>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ company?.domain || 'N/A' }}</p>
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
      
      <!-- Financial Settings -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Financial Settings</h2>
          <button 
            @click="editingFinancials = !editingFinancials"
            class="btn-secondary text-sm"
          >
            {{ editingFinancials ? 'Cancel' : 'Edit' }}
          </button>
        </div>
        
        <div v-if="!editingFinancials" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Net Margin</label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ targetNetMargin }}%</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Used to calculate target revenue line on charts</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Expenses Override</label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ monthlyExpensesOverride ? formatCurrency(monthlyExpensesOverride) : 'Auto (from previous month)' }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Leave blank to use previous month's actual expenses
                <span v-if="!monthlyExpensesOverride && revenueStore.balances?.monthlyExpenses">
                  ({{ formatCurrency(revenueStore.balances.monthlyExpenses) }})
                </span>
              </p>
            </div>
          </div>
        </div>
        
        <div v-else class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Net Margin (%)</label>
              <input
                type="number"
                v-model.number="editableTargetNetMargin"
                class="input mt-1"
                placeholder="20"
                min="1"
                max="50"
                step="0.1"
              />
              <p class="text-xs text-gray-500 mt-1">Percentage (e.g., 20 for 20% margin)</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Expenses Override</label>
              <input
                type="number"
                v-model.number="editableMonthlyExpensesOverride"
                class="input mt-1"
                placeholder="Leave blank for auto"
                min="0"
                step="1000"
              />
              <p class="text-xs text-gray-500 mt-1">
                Leave blank to use previous month's actual expenses
                <span v-if="revenueStore.balances?.monthlyExpenses">
                  ({{ formatCurrency(revenueStore.balances.monthlyExpenses) }})
                </span>
              </p>
            </div>
          </div>
          <div class="flex justify-end space-x-3">
            <button @click="editingFinancials = false" class="btn-secondary">
              Cancel
            </button>
            <button @click="saveFinancialSettings" class="btn-primary">
              Save Changes
            </button>
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
              <h3 class="font-medium text-gray-900 dark:text-gray-100">Last Data Refresh</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ lastRefresh || 'Never' }}</p>
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
import { useRevenueStore } from '../stores/revenue'
import { useDarkMode } from '../composables/useDarkMode'
import AppLayout from '../components/AppLayout.vue'

const authStore = useAuthStore()
const revenueStore = useRevenueStore()
const { isDarkMode, toggleDarkMode } = useDarkMode()

const showPipedriveModal = ref(false)
const pipedriveApiKey = ref('')
const archiveRetentionDays = ref(365)
const refreshing = ref(false)
const lastRefresh = ref(null)

const qboConnected = ref(false)
const pipedriveConnected = ref(false)

const editingCompany = ref(false)
const editableCompanyName = ref('')

const editingFinancials = ref(false)
const targetNetMargin = ref(20)
const monthlyExpensesOverride = ref(null)
const editableTargetNetMargin = ref(20)
const editableMonthlyExpensesOverride = ref(null)

const company = computed(() => authStore.company)

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

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

async function saveFinancialSettings() {
  try {
    const response = await fetch('/.netlify/functions/company-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ 
        targetNetMargin: editableTargetNetMargin.value,
        monthlyExpensesOverride: editableMonthlyExpensesOverride.value || null
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update financial settings')
    }
    
    // Update local values
    targetNetMargin.value = editableTargetNetMargin.value
    monthlyExpensesOverride.value = editableMonthlyExpensesOverride.value || null
    editingFinancials.value = false
    
    // Update the auth store with the new company info
    await authStore.fetchCurrentUser()
    
  } catch (error) {
    console.error('Error saving financial settings:', error)
    alert('Failed to save financial settings: ' + error.message)
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





// Watch for editing company to populate the field
watch(() => editingCompany.value, (isEditing) => {
  if (isEditing) {
    editableCompanyName.value = company.value?.name || ''
  }
})

// Watch for editing financials to populate the fields
watch(() => editingFinancials.value, (isEditing) => {
  if (isEditing) {
    editableTargetNetMargin.value = targetNetMargin.value
    editableMonthlyExpensesOverride.value = monthlyExpensesOverride.value
  }
})

// Watch for company changes to update financial settings
watch(() => company.value, (newCompany) => {
  if (newCompany && newCompany.settings) {
    targetNetMargin.value = newCompany.settings.targetNetMargin || 20
    monthlyExpensesOverride.value = newCompany.settings.monthlyExpensesOverride || null
  }
}, { immediate: true })

onMounted(async () => {
  // Load current settings
  lastRefresh.value = 'Today at 3:00 AM'
  await checkConnectionStatus()
  
  // Initialize financial settings from company data
  if (company.value?.settings) {
    targetNetMargin.value = company.value.settings.targetNetMargin || 20
    monthlyExpensesOverride.value = company.value.settings.monthlyExpensesOverride || null
  }
})
</script>