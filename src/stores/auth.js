import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService from '../services/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token'))
  const company = ref(null)
  
  const isAuthenticated = computed(() => !!token.value)
  
  async function login(googleToken) {
    try {
      const response = await authService.googleLogin(googleToken)
      token.value = response.token
      user.value = response.user
      company.value = response.company
      localStorage.setItem('token', response.token)
      return response
    } catch (error) {
      console.error('Login failed:', error)
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
    logout,
    fetchCurrentUser
  }
})