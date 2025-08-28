<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

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

/* Ensure hover states work properly with zebra stripes */
tbody tr:hover {
  background-color: #f3f4f6; /* bg-gray-100 */
}
</style>
