<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <h1 class="text-center text-4xl font-bold text-primary-600">BI Forecast</h1>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
          Sign in to your account
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Revenue forecasting and analytics
        </p>
      </div>
      
      <div class="card">
        <!-- Google Sign-In Button -->
        <div v-if="googleAuth.isLoaded" id="google-signin-button" class="mb-4"></div>
        
        <!-- Fallback button -->
        <button
          v-if="!googleAuth.isLoaded"
          @click="handleGoogleLogin"
          :disabled="googleAuth.isLoading || !clientIdConfigured"
          class="w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {{ getButtonText() }}
        </button>
        
        <div v-if="displayError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-600">{{ displayError }}</p>
        </div>
        
        <div v-if="!clientIdConfigured" class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p class="text-sm text-yellow-600">
            Google Client ID not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file.
          </p>
        </div>
      </div>
      
      <p class="mt-4 text-center text-xs text-gray-500">
        Only authorized company domain emails are allowed
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useGoogleAuth } from '../composables/useGoogleAuth'

const router = useRouter()
const authStore = useAuthStore()
const googleAuth = useGoogleAuth()

const clientIdConfigured = computed(() => {
  return !!import.meta.env.VITE_GOOGLE_CLIENT_ID
})

const displayError = computed(() => {
  return googleAuth.error.value
})

function getButtonText() {
  if (googleAuth.isLoading.value) return 'Signing in...'
  if (!clientIdConfigured.value) return 'Google Client ID Not Configured'
  if (!googleAuth.isLoaded.value) return 'Loading Google Sign-In...'
  return 'Sign in with Google'
}

async function handleGoogleLogin() {
  try {
    await googleAuth.signIn()
  } catch (err) {
    console.error('Login error:', err)
  }
}

// Handle successful authentication
async function handleAuthSuccess(authData) {
  try {
    // Update auth store
    await authStore.login(authData.token)
    
    // Redirect to dashboard
    router.push('/')
  } catch (err) {
    console.error('Post-auth error:', err)
    googleAuth.error.value = 'Login succeeded but failed to initialize app. Please try again.'
  }
}

// Listen for successful authentication
const handleGoogleAuthSuccess = async (event) => {
  console.log('Received googleAuthSuccess event', event.detail)
  await handleAuthSuccess(event.detail)
}

// Add event listener
onMounted(() => {
  window.addEventListener('googleAuthSuccess', handleGoogleAuthSuccess)
})

// Clean up event listener
onUnmounted(() => {
  window.removeEventListener('googleAuthSuccess', handleGoogleAuthSuccess)
})

// Render Google button when loaded
watch(() => googleAuth.isLoaded.value, async (isLoaded) => {
  if (isLoaded && clientIdConfigured.value) {
    await nextTick()
    try {
      googleAuth.renderButton('google-signin-button', {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with'
      })
    } catch (err) {
      console.error('Failed to render Google button:', err)
    }
  }
})

onMounted(() => {
  // Disable One Tap for development to avoid origin issues
  // if (clientIdConfigured.value) {
  //   setTimeout(() => {
  //     googleAuth.signInWithOneTap()
  //   }, 1000)
  // }
})
</script>