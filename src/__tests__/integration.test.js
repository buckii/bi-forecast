import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRevenueStore } from '../stores/revenue'
import { useAuthStore } from '../stores/auth'
import { useDataRefresh } from '../composables/useDataRefresh'
import revenueService from '../services/revenue'
import { format, startOfMonth } from 'date-fns'

// Mock services
vi.mock('../services/revenue')
vi.mock('../services/auth')

// Mock fetch for composables
global.fetch = vi.fn()

describe('Integration Tests - Complex User Flows', () => {
  let revenueStore
  let authStore

  beforeEach(() => {
    setActivePinia(createPinia())
    revenueStore = useRevenueStore()
    authStore = useAuthStore()
    vi.clearAllMocks()
    
    // Mock auth store state
    authStore.token = 'mock-jwt-token'
    authStore.user = { id: 1, name: 'Test User' }
    authStore.company = { _id: 'company-123', name: 'Test Company' }
  })

  describe('Dashboard Data Loading Flow', () => {
    it('should handle complete dashboard initialization', async () => {
      const mockRevenueData = {
        months: [
          {
            month: '2024-01-01',
            components: {
              invoiced: 10000,
              journalEntries: 5000,
              delayedCharges: 2000,
              monthlyRecurring: 3000,
              wonUnscheduled: 1000,
              weightedSales: 1500
            }
          },
          {
            month: '2024-02-01',
            components: {
              invoiced: 12000,
              journalEntries: 5500,
              delayedCharges: 2200,
              monthlyRecurring: 3000,
              wonUnscheduled: 800,
              weightedSales: 2000
            }
          }
        ],
        exceptions: {
          overdueDeals: [{ id: 1, amount: 5000 }],
          pastDelayedCharges: [{ id: 2, amount: 1000 }],
          wonUnscheduled: []
        },
        balances: {
          assets: [
            { name: 'Checking', balance: 50000 },
            { name: 'Savings', balance: 100000 }
          ],
          receivables: { total: 25000 },
          monthlyExpenses: 15000,
          yearUnbilled: 120000,
          thirtyDaysUnbilled: 10000
        },
        lastUpdated: '2024-01-15T10:00:00Z'
      }

      revenueService.getCurrentData.mockResolvedValue(mockRevenueData)

      // Load initial data
      await revenueStore.loadRevenueData()

      // Verify store state
      expect(revenueStore.revenueData).toHaveLength(2)
      expect(revenueStore.exceptions.overdueDeals).toHaveLength(1)
      expect(revenueStore.totalCashOnHand).toBe(150000)
      expect(revenueStore.totalReceivables).toBe(25000)
      expect(revenueStore.lastUpdated).toBe('2024-01-15T10:00:00Z')
      expect(revenueStore.loading).toBe(false)
      expect(revenueStore.error).toBeNull()
    })

    it('should handle revenue data loading with weighted sales toggle', async () => {
      // Use current month for the test data
      const currentMonthString = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const mockRevenueData = {
        months: [{
          month: currentMonthString,
          components: {
            invoiced: 10000,
            journalEntries: 5000,
            delayedCharges: 2000,
            monthlyRecurring: 3000,
            wonUnscheduled: 1000,
            weightedSales: 5000
          }
        }],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      }

      revenueService.getCurrentData.mockResolvedValue(mockRevenueData)
      await revenueStore.loadRevenueData()

      // Initial revenue with weighted sales
      const initialRevenue = revenueStore.currentMonthRevenue
      expect(initialRevenue).toBe(26000) // Sum including weighted sales

      // Toggle weighted sales off
      revenueStore.includeWeightedSales = false
      const revenueWithoutWeighted = revenueStore.currentMonthRevenue
      expect(revenueWithoutWeighted).toBe(21000) // Sum without weighted sales

      // Toggle back on
      revenueStore.includeWeightedSales = true
      expect(revenueStore.currentMonthRevenue).toBe(26000)
    })
  })

  describe('Data Refresh Flow', () => {
    it('should handle complete QBO refresh workflow', async () => {
      const { refreshQBO, qboLastRefresh, refreshingQBO } = useDataRefresh()

      // Mock successful QBO refresh
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { lastUpdated: '2024-01-15T11:00:00Z' }
        })
      })

      // Mock revenue data reload
      const updatedRevenueData = {
        months: [{ month: '2024-01-01', components: { invoiced: 15000 } }],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      }
      revenueService.getCurrentData.mockResolvedValue(updatedRevenueData)

      // Initial state
      expect(refreshingQBO.value).toBe(false)
      expect(qboLastRefresh.value).toBeNull()

      // Start refresh
      const refreshPromise = refreshQBO()
      expect(refreshingQBO.value).toBe(true)

      // Wait for completion
      await refreshPromise

      // Verify final state
      expect(refreshingQBO.value).toBe(false)
      expect(qboLastRefresh.value).toBe('2024-01-15T11:00:00Z')
      expect(revenueService.getCurrentData).toHaveBeenCalledWith(true) // Cache bypass
      expect(revenueStore.revenueData[0].components.invoiced).toBe(15000)
    })

    it('should handle refresh failure and recovery', async () => {
      const { refreshQBO, refreshingQBO } = useDataRefresh()

      // Mock failed refresh
      global.fetch.mockRejectedValue(new Error('Server unavailable'))

      let error
      try {
        await refreshQBO()
      } catch (err) {
        error = err
      }

      expect(error.message).toBe('Server unavailable')
      expect(refreshingQBO.value).toBe(false)

      // Mock successful retry
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { lastUpdated: '2024-01-15T12:00:00Z' }
        })
      })

      revenueService.getCurrentData.mockResolvedValue({
        months: [],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      })

      // Retry should work
      await refreshQBO()
      expect(refreshingQBO.value).toBe(false)
    })
  })

  describe('Historical Data Navigation', () => {
    it('should handle switching between current and historical data', async () => {
      // Load current data
      const currentData = {
        months: [{ month: '2024-01-01', components: { invoiced: 10000 } }],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 },
        lastUpdated: '2024-01-15T10:00:00Z'
      }
      revenueService.getCurrentData.mockResolvedValue(currentData)

      await revenueStore.loadRevenueData()
      expect(revenueStore.isHistorical).toBe(false)
      expect(revenueStore.lastUpdated).toBe('2024-01-15T10:00:00Z')

      // Switch to historical data
      const historicalData = {
        months: [{ month: '2023-12-01', components: { invoiced: 8000 } }],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      }
      revenueService.getHistoricalData.mockResolvedValue(historicalData)

      const historicalDate = new Date('2023-12-01')
      await revenueStore.loadRevenueData(historicalDate)

      expect(revenueStore.isHistorical).toBe(true)
      expect(revenueStore.selectedDate).toEqual(historicalDate)
      expect(revenueStore.revenueData[0].components.invoiced).toBe(8000)
      expect(revenueStore.lastUpdated).toBeNull() // Historical data doesn't have lastUpdated

      // Switch back to current
      await revenueStore.loadRevenueData()
      expect(revenueStore.isHistorical).toBe(false)
      expect(revenueStore.lastUpdated).toBe('2024-01-15T10:00:00Z')
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle cascading failures gracefully', async () => {
      // Initial load fails
      revenueService.getCurrentData.mockRejectedValue(new Error('Database connection failed'))

      await revenueStore.loadRevenueData()
      expect(revenueStore.error).toBe('Database connection failed')
      expect(revenueStore.loading).toBe(false)
      expect(revenueStore.revenueData).toEqual([])

      // Refresh also fails
      const { refreshQBO } = useDataRefresh()
      global.fetch.mockRejectedValue(new Error('API server down'))

      try {
        await refreshQBO()
      } catch (error) {
        expect(error.message).toBe('API server down')
      }

      // Recovery: services come back online
      const recoveryData = {
        months: [{ month: '2024-01-01', components: { invoiced: 5000 } }],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      }
      revenueService.getCurrentData.mockResolvedValue(recoveryData)

      // Should recover successfully
      await revenueStore.loadRevenueData()
      expect(revenueStore.error).toBeNull()
      expect(revenueStore.revenueData).toHaveLength(1)
    })
  })

  describe('Cache Behavior Integration', () => {
    it('should handle cache bypass flow correctly', async () => {
      const { refreshQBO } = useDataRefresh()
      
      // Normal load should use cache
      const cachedData = {
        months: [{ month: '2024-01-01', components: { invoiced: 10000 } }],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      }
      revenueService.getCurrentData.mockResolvedValue(cachedData)

      await revenueStore.loadRevenueData()
      expect(revenueService.getCurrentData).toHaveBeenCalledWith(false)

      // Refresh should bypass cache
      global.fetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { lastUpdated: '2024-01-15T10:00:00Z' }
        })
      })

      const freshData = {
        months: [{ month: '2024-01-01', components: { invoiced: 12000 } }],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      }
      revenueService.getCurrentData.mockResolvedValue(freshData)

      await refreshQBO()
      expect(revenueService.getCurrentData).toHaveBeenCalledWith(true) // Cache bypass
      expect(revenueStore.revenueData[0].components.invoiced).toBe(12000)
    })
  })

  describe('Performance and Concurrency', () => {
    it('should handle concurrent operations correctly', async () => {
      const { refreshQBO, refreshPipedrive } = useDataRefresh()

      // Mock both refresh endpoints
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            data: { lastUpdated: '2024-01-15T10:00:00Z' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            data: { lastUpdated: '2024-01-15T10:05:00Z' }
          })
        })

      // Mock revenue reload calls
      revenueService.getCurrentData.mockResolvedValue({
        months: [],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      })

      // Start both refreshes concurrently
      const qboPromise = refreshQBO()
      const pipedrivePromise = refreshPipedrive()

      // Should complete both successfully
      await Promise.all([qboPromise, pipedrivePromise])

      // Should have called both endpoints
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(revenueService.getCurrentData).toHaveBeenCalledTimes(2)
    })
  })
})