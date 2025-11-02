import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService from '../services/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token'))
  const company = ref(null)
  
  const isAuthenticated = computed(() => !!token.value)
  
  async function login(jwtToken) {
    try {
      // If we receive a JWT token directly, use it
      if (jwtToken) {
        token.value = jwtToken
        localStorage.setItem('token', jwtToken)
        
        // Fetch user data with the token
        const response = await authService.getCurrentUser()
        user.value = response.user
        company.value = response.company
        return response
      } else {
        throw new Error('No token provided')
      }
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }
  
  async function loginWithGoogle(googleToken) {
    try {
      const response = await authService.googleLogin(googleToken)
      token.value = response.token
      user.value = response.user
      company.value = response.company
      localStorage.setItem('token', response.token)
      return response
    } catch (error) {
      console.error('Google login failed:', error)
      throw error
    }
  }

  async function devLogin() {
    try {
      const response = await authService.devLogin()
      token.value = response.token
      user.value = response.user
      company.value = response.company
      localStorage.setItem('token', response.token)
      return response
    } catch (error) {
      console.error('Dev login failed:', error)
      throw error
    }
  }
  
  function logout() {
    user.value = null
    token.value = null
    company.value = null
    localStorage.removeItem('token')
  }
  
  async function fetchCurrentUser() {
    if (!token.value) return null
    
    try {
      const response = await authService.getCurrentUser()
      user.value = response.user
      company.value = response.company
      return response
    } catch (error) {
      console.error('Failed to fetch user:', error)
      logout()
      throw error
    }
  }
  
  return {
    user,
    token,
    company,
    isAuthenticated,
    login,
    loginWithGoogle,
    devLogin,
    logout,
    fetchCurrentUser
  }
})