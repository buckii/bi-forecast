<template>
  <AppLayout>
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">User Access Management</h1>
      
      <!-- Domain Access Section -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Domain Access</h2>
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p class="text-sm font-medium text-blue-800 dark:text-blue-200">
                Current domain: <strong>{{ company?.domain || 'Not set' }}</strong>
              </p>
              <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                All users with email addresses from this domain automatically get access
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Add User Section -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Grant Access to New User</h2>
        <form @submit.prevent="addUser" class="space-y-4">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              id="email"
              v-model="newUserEmail"
              type="email"
              required
              placeholder="user@example.com"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Must be a valid Google account email address
            </p>
          </div>
          <div>
            <label for="role" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              id="role"
              v-model="newUserRole"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            :disabled="!newUserEmail || addingUser"
            class="btn-primary flex items-center space-x-2"
          >
            <div v-if="addingUser" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span>{{ addingUser ? 'Adding...' : 'Grant Access' }}</span>
          </button>
        </form>
      </div>

      <!-- Current Users Section -->
      <div class="card">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Current Users</h2>
          <button 
            @click="loadUsers"
            :disabled="loading"
            class="btn-secondary flex items-center space-x-2"
          >
            <div v-if="loading" class="animate-spin h-4 w-4 border-2 border-gray-600 border-t-transparent rounded-full"></div>
            <span>{{ loading ? 'Loading...' : 'Refresh' }}</span>
          </button>
        </div>

        <div v-if="loading && !users.length" class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span class="ml-3 text-gray-600 dark:text-gray-400">Loading users...</span>
        </div>

        <div v-else-if="users.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
          No users found
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead>
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Added
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="user in users" :key="user._id" class="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {{ user.email }}
                    </div>
                    <span v-if="user.email === currentUserEmail" class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      You
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        :class="user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'">
                    {{ user.role }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ formatDate(user.createdAt) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    v-if="user.email !== currentUserEmail"
                    @click="confirmRemoveUser(user)"
                    :disabled="removingUserId === user._id"
                    class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                  >
                    {{ removingUserId === user._id ? 'Removing...' : 'Remove' }}
                  </button>
                  <span v-else class="text-gray-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Remove User Confirmation Modal -->
    <div v-if="userToRemove" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="cancelRemoveUser" class="fixed inset-0 bg-black bg-opacity-50"></div>
      <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Remove User Access</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to remove access for <strong>{{ userToRemove.email }}</strong>? 
          They will no longer be able to sign in to the application.
        </p>
        <div class="flex justify-end space-x-3">
          <button
            @click="cancelRemoveUser"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            @click="removeUser"
            :disabled="removingUserId === userToRemove._id"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <div v-if="removingUserId === userToRemove._id" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span>{{ removingUserId === userToRemove._id ? 'Removing...' : 'Remove Access' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Error/Success Messages -->
    <div v-if="message" class="fixed bottom-4 right-4 z-50">
      <div class="p-4 rounded-md shadow-lg"
           :class="message.type === 'error' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'">
        <p class="text-sm"
           :class="message.type === 'error' ? 'text-red-600' : 'text-green-600'">
          {{ message.text }}
        </p>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import AppLayout from '../components/AppLayout.vue'
import { format } from 'date-fns'

const authStore = useAuthStore()

const users = ref([])
const loading = ref(false)
const addingUser = ref(false)
const removingUserId = ref(null)
const newUserEmail = ref('')
const newUserRole = ref('viewer')
const userToRemove = ref(null)
const message = ref(null)

const currentUserEmail = computed(() => authStore.user?.email)
const company = computed(() => authStore.company)

function formatDate(dateString) {
  if (!dateString) return ''
  return format(new Date(dateString), 'MMM dd, yyyy')
}

function showMessage(text, type = 'success') {
  message.value = { text, type }
  setTimeout(() => {
    message.value = null
  }, 5000)
}

async function loadUsers() {
  loading.value = true
  try {
    const response = await fetch('/.netlify/functions/users-list', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to load users: ${response.statusText}`)
    }

    const data = await response.json()
    users.value = data.data?.users || data.users || []
  } catch (error) {
    console.error('Error loading users:', error)
    showMessage('Failed to load users', 'error')
  } finally {
    loading.value = false
  }
}

async function addUser() {
  if (!newUserEmail.value) return

  addingUser.value = true
  try {
    const response = await fetch('/.netlify/functions/users-add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        email: newUserEmail.value.toLowerCase().trim(),
        role: newUserRole.value
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to add user: ${response.statusText}`)
    }

    showMessage(`Access granted to ${newUserEmail.value}`)
    newUserEmail.value = ''
    newUserRole.value = 'viewer'
    await loadUsers()
  } catch (error) {
    console.error('Error adding user:', error)
    showMessage(error.message, 'error')
  } finally {
    addingUser.value = false
  }
}

function confirmRemoveUser(user) {
  userToRemove.value = user
}

function cancelRemoveUser() {
  userToRemove.value = null
}

async function removeUser() {
  if (!userToRemove.value) return

  removingUserId.value = userToRemove.value._id
  try {
    const response = await fetch('/.netlify/functions/users-remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        userId: userToRemove.value._id
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Failed to remove user: ${response.statusText}`)
    }

    showMessage(`Access removed for ${userToRemove.value.email}`)
    userToRemove.value = null
    await loadUsers()
  } catch (error) {
    console.error('Error removing user:', error)
    showMessage(error.message, 'error')
  } finally {
    removingUserId.value = null
  }
}

onMounted(() => {
  loadUsers()
})
</script>