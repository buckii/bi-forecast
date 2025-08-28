<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useDarkMode } from './composables/useDarkMode'

const authStore = useAuthStore()
const { isDarkMode } = useDarkMode()

onMounted(async () => {
  if (authStore.isAuthenticated) {
    try {
      await authStore.fetchCurrentUser()
    } catch (error) {
      console.error('Failed to fetch user:', error)
    }
  }
})
</script>

<template>
  <RouterView />
</template>

<style>
/* Zebra striping for all tables */
tbody tr:nth-child(even) {
  background-color: #f9fafb; /* bg-gray-50 */
}

tbody tr:nth-child(odd) {
  background-color: #ffffff; /* bg-white */
}

/* Dark mode zebra striping */
.dark tbody tr:nth-child(even) {
  background-color: #374151; /* bg-gray-700 */
}

.dark tbody tr:nth-child(odd) {
  background-color: #1f2937; /* bg-gray-800 */
}

/* Ensure hover states work properly with zebra stripes */
tbody tr:hover {
  background-color: #f3f4f6; /* bg-gray-100 */
}

.dark tbody tr:hover {
  background-color: #4b5563; /* bg-gray-600 */
}
</style>
