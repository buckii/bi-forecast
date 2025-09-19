import { ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRevenueStore } from '../stores/revenue'

export function useDataRefresh() {
  const authStore = useAuthStore()
  const revenueStore = useRevenueStore()
  
  // Reactive state
  const refreshingQBO = ref(false)
  const refreshingPipedrive = ref(false)
  const qboLastRefresh = ref(null)
  const pipedriveLastRefresh = ref(null)
  
  // Format timestamp for display
  function formatLastRefresh(timestamp) {
    if (!timestamp) return 'Never'
    
    const date = new Date(timestamp)
    const now = new Date()
    const diffMinutes = Math.floor((now - date) / 60000)
    
    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }
  
  // Format timestamp for tooltip (absolute datetime)
  function formatRefreshTooltip(timestamp) {
    if (!timestamp) return 'Never refreshed'
    
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    })
  }
  
  // Update refresh timestamps from revenue store data
  function updateRefreshTimes() {
    const lastUpdated = revenueStore.lastUpdated
    if (lastUpdated) {
      // Since both QBO and Pipedrive refresh together, they share the same timestamp
      qboLastRefresh.value = lastUpdated
      pipedriveLastRefresh.value = lastUpdated
    }
  }
  
  // Watch for changes in revenue store's lastUpdated value
  watch(() => revenueStore.lastUpdated, () => {
    updateRefreshTimes()
  })
  
  // Refresh QBO data
  async function refreshQBO() {
    refreshingQBO.value = true
    try {
      const response = await fetch('/.netlify/functions/revenue-refresh-qbo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to refresh QBO data')
      }
      
      const data = await response.json()
      qboLastRefresh.value = data.data.lastUpdated
      
      // Trigger revenue store refresh with cache bypass
      await revenueStore.loadRevenueData(null, true)
      
    } catch (error) {
      console.error('Error refreshing QBO data:', error)
      throw error // Re-throw so calling component can handle UI feedback
    } finally {
      refreshingQBO.value = false
    }
  }
  
  // Refresh Pipedrive data
  async function refreshPipedrive() {
    refreshingPipedrive.value = true
    try {
      const response = await fetch('/.netlify/functions/revenue-refresh-pipedrive', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authStore.token}`
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to refresh Pipedrive data')
      }
      
      const data = await response.json()
      pipedriveLastRefresh.value = data.data.lastUpdated
      
      // Trigger revenue store refresh with cache bypass
      await revenueStore.loadRevenueData(null, true)
      
    } catch (error) {
      console.error('Error refreshing Pipedrive data:', error)
      throw error // Re-throw so calling component can handle UI feedback
    } finally {
      refreshingPipedrive.value = false
    }
  }
  
  // Initialize refresh times on composable creation
  // Note: This is now handled by the revenue store to avoid duplicate API calls
  // fetchLastRefreshTimes()
  
  return {
    // State
    refreshingQBO,
    refreshingPipedrive,
    qboLastRefresh,
    pipedriveLastRefresh,
    
    // Methods
    formatLastRefresh,
    formatRefreshTooltip,
    updateRefreshTimes,
    refreshQBO,
    refreshPipedrive
  }
}