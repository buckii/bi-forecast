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
