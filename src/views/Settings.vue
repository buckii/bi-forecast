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
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Price Per Point</label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ formatCurrency(pricePerPoint) }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Used to calculate point values on transaction details</p>
            </div>
          </div>
        </div>
        
        <div v-else class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Price Per Point ($)</label>
              <input
                type="number"
                v-model.number="editablePricePerPoint"
                class="input mt-1"
                placeholder="550"
                min="1"
                step="10"
              />
              <p class="text-xs text-gray-500 mt-1">Dollar amount per point (e.g., 550)</p>
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

      <!-- Client Aliases -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Client Aliases</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Map alternative client names to primary names for accurate revenue tracking</p>
          </div>
          <button
            @click="addNewClient"
            class="btn-primary text-sm"
          >
            Add Client
          </button>
        </div>

        <div v-if="clientAliases.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No client aliases configured yet.</p>
          <p class="text-sm mt-1">Click "Add Client" to create your first client mapping.</p>
        </div>

        <div v-else class="space-y-2">
          <div v-for="client in sortedClientAliases" :key="'client-' + client._id" class="border dark:border-gray-600 rounded-lg overflow-hidden">
            <!-- Client name button -->
            <button
              @click="toggleClientEdit(client._id)"
              class="w-full text-left px-4 py-3 transition-colors flex items-center justify-between"
              :class="editingClientId === client._id
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
            >
              <span class="text-sm font-medium">{{ client.primaryName || '(New Client)' }}</span>
              <svg
                class="h-5 w-5 flex-shrink-0 transition-transform"
                :class="editingClientId === client._id ? 'transform rotate-180' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Inline editing form -->
            <div v-if="editingClientId === client._id" class="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Primary Client Name
                  </label>
                  <input
                    type="text"
                    v-model="client.primaryName"
                    class="input"
                    placeholder="e.g., Acme Corporation"
                    ref="clientNameInput"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Aliases / Alternative Names
                    <span class="text-xs text-gray-500 dark:text-gray-400">(comma-separated)</span>
                  </label>
                  <textarea
                    v-model="client.aliases"
                    class="input"
                    rows="2"
                    placeholder="e.g., Acme, Acme Corp, ACME Corporation"
                  ></textarea>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    These names will be matched in journal entry descriptions
                  </p>
                </div>

                <div class="flex justify-end space-x-3 pt-2">
                  <button
                    @click="deleteClient(client._id)"
                    class="btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                  <button
                    @click="saveIndividualClient(client._id)"
                    class="btn-primary"
                  >
                    Save
                  </button>
                </div>
              </div>
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
              <h3 class="font-medium text-gray-900 dark:text-gray-100">Refresh QBO Data</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400" :title="formatRefreshTooltip(qboLastRefresh)">{{ formatLastRefresh(qboLastRefresh) }}</p>
            </div>
            <button @click="refreshQBO" :disabled="refreshingQBO" class="btn-primary flex items-center space-x-2">
              <div v-if="refreshingQBO" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span>{{ refreshingQBO ? 'Refreshing...' : 'Refresh QBO' }}</span>
            </button>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-gray-100">Refresh Pipedrive Data</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400" :title="formatRefreshTooltip(pipedriveLastRefresh)">{{ formatLastRefresh(pipedriveLastRefresh) }}</p>
            </div>
            <button @click="refreshPipedrive" :disabled="refreshingPipedrive" class="btn-primary flex items-center space-x-2">
              <div v-if="refreshingPipedrive" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              <span>{{ refreshingPipedrive ? 'Refreshing...' : 'Refresh Pipedrive' }}</span>
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
  <ToastContainer />
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRevenueStore } from '../stores/revenue'
import { useDarkMode } from '../composables/useDarkMode'
import { useDataRefresh } from '../composables/useDataRefresh'
import { useToast } from '../composables/useToast'
import AppLayout from '../components/AppLayout.vue'
import ToastContainer from '../components/ToastContainer.vue'

const authStore = useAuthStore()
const revenueStore = useRevenueStore()
const { isDarkMode, toggleDarkMode } = useDarkMode()
const toast = useToast()
const {
  refreshingQBO,
  refreshingPipedrive,
  qboLastRefresh,
  pipedriveLastRefresh,
  formatLastRefresh,
  formatRefreshTooltip,
  refreshQBO: baseRefreshQBO,
  refreshPipedrive: baseRefreshPipedrive
} = useDataRefresh()

const showPipedriveModal = ref(false)
const pipedriveApiKey = ref('')
const archiveRetentionDays = ref(365)

const qboConnected = ref(false)
const pipedriveConnected = ref(false)

const editingCompany = ref(false)
const editableCompanyName = ref('')

const editingFinancials = ref(false)
const targetNetMargin = ref(20)
const monthlyExpensesOverride = ref(null)
const pricePerPoint = ref(550)
const editableTargetNetMargin = ref(20)
const editableMonthlyExpensesOverride = ref(null)
const editablePricePerPoint = ref(550)

const clientAliases = ref([])
const originalClientAliases = ref([])
const editingClientId = ref(null)
let nextClientId = 0

// Don't use computed - just reference clientAliases directly
// We'll sort once on load instead of reactively
const sortedClientAliases = computed(() => {
  // Return unsorted list to prevent jumping while editing
  return clientAliases.value
})

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
        monthlyExpensesOverride: editableMonthlyExpensesOverride.value || null,
        pricePerPoint: editablePricePerPoint.value
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update financial settings')
    }

    // Update local values
    targetNetMargin.value = editableTargetNetMargin.value
    monthlyExpensesOverride.value = editableMonthlyExpensesOverride.value || null
    pricePerPoint.value = editablePricePerPoint.value
    editingFinancials.value = false

    // Update the auth store with the new company info
    await authStore.fetchCurrentUser()

  } catch (error) {
    console.error('Error saving financial settings:', error)
    alert('Failed to save financial settings: ' + error.message)
  }
}

// Wrapper functions to add Settings-specific error handling
async function refreshQBO() {
  try {
    await baseRefreshQBO()
  } catch (error) {
    alert('Failed to refresh QBO data: ' + error.message)
  }
}

async function refreshPipedrive() {
  try {
    await baseRefreshPipedrive()
  } catch (error) {
    alert('Failed to refresh Pipedrive data: ' + error.message)
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
    // Connection status check failed - ignore silently
  }
}

function toggleClientEdit(clientId) {
  if (editingClientId.value === clientId) {
    editingClientId.value = null
  } else {
    editingClientId.value = clientId
  }
}

function addNewClient() {
  const newClient = {
    _id: nextClientId++,
    primaryName: '',
    aliases: ''
  }
  // Add to the top of the list so it appears right under the "Add Client" button
  clientAliases.value.unshift(newClient)
  editingClientId.value = newClient._id
}

async function deleteClient(clientId) {
  try {
    // Find and remove the client
    const actualIndex = clientAliases.value.findIndex(c => c._id === clientId)

    if (actualIndex !== -1) {
      clientAliases.value.splice(actualIndex, 1)
    }

    // Close editing panel
    editingClientId.value = null

    // Save all remaining clients
    await saveAllClientAliases()
    toast.success('Client deleted successfully')
  } catch (error) {
    console.error('Error deleting client:', error)
    toast.error('Failed to delete client: ' + error.message)
  }
}

async function saveIndividualClient(clientId) {
  try {
    const client = clientAliases.value.find(c => c._id === clientId)

    if (!client || !client.primaryName.trim()) {
      toast.warning('Please enter a primary client name')
      return
    }

    // Save all clients (backend replaces all at once)
    await saveAllClientAliases()

    editingClientId.value = null
    toast.success('Client saved successfully')
  } catch (error) {
    console.error('Error saving client:', error)
    toast.error('Failed to save client: ' + error.message)
  }
}

async function saveAllClientAliases() {
  // Transform comma-separated aliases string into array
  const aliasesData = clientAliases.value
    .filter(c => c.primaryName.trim()) // Only include clients with a primary name
    .map(c => ({
      primaryName: c.primaryName.trim(),
      aliases: c.aliases.split(',').map(a => a.trim()).filter(a => a) // Split, trim, remove empties
    }))

  const response = await fetch('/.netlify/functions/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authStore.token}`
    },
    body: JSON.stringify({
      clientAliases: aliasesData
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.message || 'Failed to save client aliases')
  }

  // Reload to get fresh data
  await loadClientAliases()
}

async function loadClientAliases() {
  try {
    const response = await fetch('/.netlify/functions/client-aliases', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (response.ok) {
      const data = await response.json()
      // Transform array of aliases back to comma-separated string for display
      // Assign unique IDs for tracking and sort alphabetically once
      const clients = data.data.clientAliases.map(c => ({
        _id: nextClientId++,
        primaryName: c.primaryName,
        aliases: c.aliases.join(', ')
      }))

      // Sort once on load
      clients.sort((a, b) =>
        a.primaryName.localeCompare(b.primaryName, undefined, { sensitivity: 'base' })
      )

      clientAliases.value = clients
      originalClientAliases.value = JSON.parse(JSON.stringify(clientAliases.value))
    }
  } catch (error) {
    console.error('Error loading client aliases:', error)
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
    editablePricePerPoint.value = pricePerPoint.value
  }
})

// Watch for company changes to update financial settings
watch(() => company.value, (newCompany) => {
  if (newCompany && newCompany.settings) {
    targetNetMargin.value = newCompany.settings.targetNetMargin || 20
    monthlyExpensesOverride.value = newCompany.settings.monthlyExpensesOverride || null
    pricePerPoint.value = newCompany.settings.pricePerPoint || 550
  }
}, { immediate: true })

onMounted(async () => {
  await checkConnectionStatus()
  // fetchLastRefreshTimes() is automatically called by useDataRefresh composable

  // Initialize financial settings from company data
  if (company.value?.settings) {
    targetNetMargin.value = company.value.settings.targetNetMargin || 20
    monthlyExpensesOverride.value = company.value.settings.monthlyExpensesOverride || null
    pricePerPoint.value = company.value.settings.pricePerPoint || 550
  }

  // Load client aliases from separate collection
  await loadClientAliases()
})
</script>