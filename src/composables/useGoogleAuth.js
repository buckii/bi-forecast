import { ref, onMounted, onUnmounted } from 'vue'

export function useGoogleAuth() {
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref(null)

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

  // Load Google Identity Services
  const loadGoogleScript = () => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts) {
        resolve(window.google)
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      
      script.onload = () => {
        if (window.google && window.google.accounts) {
          resolve(window.google)
        } else {
          reject(new Error('Google Identity Services failed to load'))
        }
      }
      
      script.onerror = () => {
        reject(new Error('Failed to load Google Identity Services script'))
      }

      document.head.appendChild(script)
    })
  }

  // Initialize Google Sign-In
  const initializeGoogleSignIn = async () => {
    try {
      if (!GOOGLE_CLIENT_ID) {
        throw new Error('Google Client ID is not configured')
      }

      const google = await loadGoogleScript()
      
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: false,
      })

      isLoaded.value = true
    } catch (err) {
      console.error('Google Sign-In initialization failed:', err)
      error.value = err.message
    }
  }

  // Handle the credential response from Google
  const handleCredentialResponse = async (response) => {
    try {
      isLoading.value = true
      error.value = null

      // The response.credential contains the JWT token from Google
      const googleToken = response.credential

      // Call your backend auth endpoint
      const authResponse = await fetch('/.netlify/functions/auth-google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: googleToken }),
      })

      console.log('Auth response status:', authResponse.status)
      console.log('Auth response headers:', authResponse.headers)
      
      if (!authResponse.ok) {
        const responseText = await authResponse.text()
        console.log('Error response text:', responseText)
        try {
          const errorData = JSON.parse(responseText)
          throw new Error(errorData.error || 'Authentication failed')
        } catch (e) {
          throw new Error(`Authentication failed: ${responseText || 'Unknown error'}`)
        }
      }

      const responseText = await authResponse.text()
      console.log('Success response text:', responseText)
      
      if (!responseText) {
        throw new Error('Empty response from server')
      }
      
      const { data } = JSON.parse(responseText)
      
      // Store the JWT token
      localStorage.setItem('token', data.token)
      
      // Trigger redirect by dispatching custom event
      console.log('Dispatching googleAuthSuccess event', data)
      window.dispatchEvent(new CustomEvent('googleAuthSuccess', {
        detail: {
          user: data.user,
          company: data.company,
          token: data.token
        }
      }))
      console.log('Event dispatched')
      
      // Emit success event or return data
      return {
        success: true,
        user: data.user,
        company: data.company,
        token: data.token
      }
      
    } catch (err) {
      console.error('Authentication error:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Trigger Google Sign-In popup
  const signIn = async () => {
    try {
      if (!isLoaded.value) {
        await initializeGoogleSignIn()
      }

      error.value = null

      // Show the Google Sign-In prompt
      window.google.accounts.id.prompt()
      
    } catch (err) {
      console.error('Sign-in error:', err)
      error.value = err.message
      throw err
    }
  }

  // Sign in with One Tap (alternative method)
  const signInWithOneTap = async () => {
    try {
      if (!isLoaded.value) {
        await initializeGoogleSignIn()
      }

      // Only show One Tap on HTTPS origins or if explicitly configured
      if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
        // Show One Tap if available
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            console.log('One Tap not displayed:', notification.getNotDisplayedReason())
          }
        })
      }
      
    } catch (err) {
      console.error('One Tap error:', err)
      error.value = err.message
    }
  }

  // Render Google Sign-In button
  const renderButton = (elementId, options = {}) => {
    if (!isLoaded.value) return

    const defaultOptions = {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: '100%',
    }

    window.google.accounts.id.renderButton(
      document.getElementById(elementId),
      { ...defaultOptions, ...options }
    )
  }

  // Initialize on mount
  onMounted(() => {
    initializeGoogleSignIn()
  })

  // Cleanup
  onUnmounted(() => {
    // Clean up Google Sign-In if needed
  })

  return {
    isLoaded,
    isLoading,
    error,
    signIn,
    signInWithOneTap,
    renderButton,
    handleCredentialResponse
  }
}