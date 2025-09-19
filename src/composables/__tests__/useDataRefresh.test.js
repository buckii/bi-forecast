import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDataRefresh } from '../useDataRefresh'
import { useAuthStore } from '../../stores/auth'
import { useRevenueStore } from '../../stores/revenue'

// Mock the stores
vi.mock('../../stores/auth')
vi.mock('../../stores/revenue')

// Mock fetch globally
global.fetch = vi.fn()

describe('useDataRefresh', () => {
  let mockAuthStore
  let mockRevenueStore

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset fetch mock
    global.fetch.mockClear()
    
    // Mock auth store
    mockAuthStore = {
      token: 'mock-jwt-token'
    }
    useAuthStore.mockReturnValue(mockAuthStore)
    
    // Mock revenue store
    mockRevenueStore = {
      loadRevenueData: vi.fn().mockResolvedValue()
    }
    useRevenueStore.mockReturnValue(mockRevenueStore)
  })

  describe('formatLastRefresh', () => {
    it('should return "Never" for null timestamp', () => {
      const { formatLastRefresh } = useDataRefresh()
      expect(formatLastRefresh(null)).toBe('Never')
      expect(formatLastRefresh(undefined)).toBe('Never')
    })

    it('should return "Just now" for recent timestamps', () => {
      const { formatLastRefresh } = useDataRefresh()
      const now = new Date()
      expect(formatLastRefresh(now.toISOString())).toBe('Just now')
    })

    it('should return minutes ago for timestamps within an hour', () => {
      const { formatLastRefresh } = useDataRefresh()
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
      expect(formatLastRefresh(thirtyMinutesAgo.toISOString())).toBe('30m ago')
    })

    it('should return hours ago for timestamps within a day', () => {
      const { formatLastRefresh } = useDataRefresh()
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      expect(formatLastRefresh(twoHoursAgo.toISOString())).toBe('2h ago')
    })

    it('should return days ago for timestamps within a week', () => {
      const { formatLastRefresh } = useDataRefresh()
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      expect(formatLastRefresh(threeDaysAgo.toISOString())).toBe('3d ago')
    })

    it('should return formatted date for older timestamps', () => {
      const { formatLastRefresh } = useDataRefresh()
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      const result = formatLastRefresh(twoWeeksAgo.toISOString())
      
      // Should contain month abbreviation and day
      expect(result).toMatch(/^[A-Za-z]{3} \d{1,2}, \d{1,2}:\d{2} [AP]M$/)
    })
  })

  describe('formatRefreshTooltip', () => {
    it('should return "Never refreshed" for null timestamp', () => {
      const { formatRefreshTooltip } = useDataRefresh()
      expect(formatRefreshTooltip(null)).toBe('Never refreshed')
      expect(formatRefreshTooltip(undefined)).toBe('Never refreshed')
    })

    it('should return formatted datetime string for valid timestamp', () => {
      const { formatRefreshTooltip } = useDataRefresh()
      const date = new Date('2024-01-15T14:30:00Z')
      const result = formatRefreshTooltip(date.toISOString())
      
      // Should contain full date and time information
      expect(result).toMatch(/Monday, January 15, 2024/)
      expect(result).toMatch(/1:30:00 PM|2:30:00 PM|9:30:00 AM/) // Handle different timezones
    })
  })

  describe('fetchLastRefreshTimes', () => {
    it('should fetch and set refresh times successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            lastUpdated: '2024-01-15T14:30:00Z'
          }
        })
      }
      
      global.fetch.mockResolvedValue(mockResponse)
      
      const { fetchLastRefreshTimes, qboLastRefresh, pipedriveLastRefresh } = useDataRefresh()
      
      await fetchLastRefreshTimes()
      
      expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/revenue-current', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-jwt-token'
        }
      })
      
      expect(qboLastRefresh.value).toBe('2024-01-15T14:30:00Z')
      expect(pipedriveLastRefresh.value).toBe('2024-01-15T14:30:00Z')
    })

    it('should handle fetch errors gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      const { fetchLastRefreshTimes, qboLastRefresh, pipedriveLastRefresh } = useDataRefresh()
      
      // Should not throw error
      await expect(fetchLastRefreshTimes()).resolves.toBeUndefined()
      
      // Values should remain unchanged
      expect(qboLastRefresh.value).toBe(null)
      expect(pipedriveLastRefresh.value).toBe(null)
    })

    it('should handle non-ok responses gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }
      
      global.fetch.mockResolvedValue(mockResponse)
      
      const { fetchLastRefreshTimes, qboLastRefresh, pipedriveLastRefresh } = useDataRefresh()
      
      // Should not throw error
      await expect(fetchLastRefreshTimes()).resolves.toBeUndefined()
      
      // Values should remain unchanged
      expect(qboLastRefresh.value).toBe(null)
      expect(pipedriveLastRefresh.value).toBe(null)
    })
  })

  describe('refreshQBO', () => {
    it('should refresh QBO data successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            lastUpdated: '2024-01-15T15:00:00Z'
          }
        })
      }
      
      global.fetch.mockResolvedValue(mockResponse)
      
      const { refreshQBO, refreshingQBO, qboLastRefresh } = useDataRefresh()
      
      await refreshQBO()
      
      expect(refreshingQBO.value).toBe(false)
      expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/revenue-refresh-qbo', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-jwt-token'
        }
      })
      
      expect(qboLastRefresh.value).toBe('2024-01-15T15:00:00Z')
      expect(mockRevenueStore.loadRevenueData).toHaveBeenCalledOnce()
    })

    it('should handle refresh errors and re-throw them', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: 'QBO refresh failed'
        })
      }
      
      global.fetch.mockResolvedValue(mockResponse)
      
      const { refreshQBO, refreshingQBO } = useDataRefresh()
      
      await expect(refreshQBO()).rejects.toThrow('QBO refresh failed')
      expect(refreshingQBO.value).toBe(false)
    })

    it('should handle network errors during refresh', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      const { refreshQBO, refreshingQBO } = useDataRefresh()
      
      await expect(refreshQBO()).rejects.toThrow('Network error')
      expect(refreshingQBO.value).toBe(false)
    })

    it('should set loading state correctly during refresh', async () => {
      // Create a promise that we can control
      let resolvePromise
      const promise = new Promise(resolve => {
        resolvePromise = resolve
      })
      
      global.fetch.mockReturnValue(promise)
      
      const { refreshQBO, refreshingQBO } = useDataRefresh()
      
      // Start the refresh
      const refreshPromise = refreshQBO()
      
      // Check loading state is true
      expect(refreshingQBO.value).toBe(true)
      
      // Resolve the promise
      resolvePromise({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { lastUpdated: '2024-01-15T15:00:00Z' }
        })
      })
      
      await refreshPromise
      
      // Check loading state is false
      expect(refreshingQBO.value).toBe(false)
    })
  })

  describe('refreshPipedrive', () => {
    it('should refresh Pipedrive data successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            lastUpdated: '2024-01-15T15:30:00Z'
          }
        })
      }
      
      global.fetch.mockResolvedValue(mockResponse)
      
      const { refreshPipedrive, refreshingPipedrive, pipedriveLastRefresh } = useDataRefresh()
      
      await refreshPipedrive()
      
      expect(refreshingPipedrive.value).toBe(false)
      expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/revenue-refresh-pipedrive', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-jwt-token'
        }
      })
      
      expect(pipedriveLastRefresh.value).toBe('2024-01-15T15:30:00Z')
      expect(mockRevenueStore.loadRevenueData).toHaveBeenCalledOnce()
    })

    it('should handle refresh errors and re-throw them', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: 'Pipedrive refresh failed'
        })
      }
      
      global.fetch.mockResolvedValue(mockResponse)
      
      const { refreshPipedrive, refreshingPipedrive } = useDataRefresh()
      
      await expect(refreshPipedrive()).rejects.toThrow('Pipedrive refresh failed')
      expect(refreshingPipedrive.value).toBe(false)
    })

    it('should handle network errors during refresh', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      const { refreshPipedrive, refreshingPipedrive } = useDataRefresh()
      
      await expect(refreshPipedrive()).rejects.toThrow('Network error')
      expect(refreshingPipedrive.value).toBe(false)
    })
  })

  describe('initialization', () => {
    it('should call fetchLastRefreshTimes on composable creation', () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { lastUpdated: '2024-01-15T14:30:00Z' }
        })
      }
      
      global.fetch.mockResolvedValue(mockResponse)
      
      // Create the composable
      useDataRefresh()
      
      // Should have called fetchLastRefreshTimes
      expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/revenue-current', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-jwt-token'
        }
      })
    })
  })

  describe('return values', () => {
    it('should return all expected properties and methods', () => {
      const result = useDataRefresh()
      
      // State properties
      expect(result).toHaveProperty('refreshingQBO')
      expect(result).toHaveProperty('refreshingPipedrive')
      expect(result).toHaveProperty('qboLastRefresh')
      expect(result).toHaveProperty('pipedriveLastRefresh')
      
      // Methods
      expect(result).toHaveProperty('formatLastRefresh')
      expect(result).toHaveProperty('formatRefreshTooltip')
      expect(result).toHaveProperty('fetchLastRefreshTimes')
      expect(result).toHaveProperty('refreshQBO')
      expect(result).toHaveProperty('refreshPipedrive')
      
      // Check that methods are functions
      expect(typeof result.formatLastRefresh).toBe('function')
      expect(typeof result.formatRefreshTooltip).toBe('function')
      expect(typeof result.fetchLastRefreshTimes).toBe('function')
      expect(typeof result.refreshQBO).toBe('function')
      expect(typeof result.refreshPipedrive).toBe('function')
    })
  })
})
