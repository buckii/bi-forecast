import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRevenueStore } from '../revenue'
import revenueService from '../../services/revenue'
import { format, startOfMonth, addMonths } from 'date-fns'

// Mock the revenue service
vi.mock('../../services/revenue')

describe('Revenue Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('loadRevenueData', () => {
    it('should load current data successfully', async () => {
      const mockData = {
        months: [{
          month: '2024-01-01',
          components: {
            invoiced: 1000,
            journalEntries: 500,
            delayedCharges: 200,
            monthlyRecurring: 300,
            wonUnscheduled: 100,
            weightedSales: 150
          }
        }],
        exceptions: { 
          overdueDeals: [], 
          pastDelayedCharges: [], 
          wonUnscheduled: [] 
        },
        balances: { 
          assets: [], 
          receivables: null, 
          monthlyExpenses: 5000,
          yearUnbilled: 10000,
          thirtyDaysUnbilled: 5000
        }
      }

      revenueService.getCurrentData.mockResolvedValue(mockData)
      
      const store = useRevenueStore()
      await store.loadRevenueData()
      
      expect(store.revenueData).toEqual(mockData.months)
      expect(store.exceptions).toEqual(mockData.exceptions)
      expect(store.balances).toEqual(mockData.balances)
      expect(store.loading).toBe(false)
      expect(store.error).toBe(null)
      expect(store.isHistorical).toBe(false)
    })

    it('should load historical data successfully', async () => {
      const mockHistoricalData = {
        months: [{
          month: '2023-12-01',
          components: {
            invoiced: 800,
            journalEntries: 400,
            delayedCharges: 150,
            monthlyRecurring: 250,
            wonUnscheduled: 80,
            weightedSales: 120
          }
        }],
        exceptions: { 
          overdueDeals: [], 
          pastDelayedCharges: [], 
          wonUnscheduled: [] 
        },
        balances: { 
          assets: [], 
          receivables: null, 
          monthlyExpenses: 4500,
          yearUnbilled: 8000,
          thirtyDaysUnbilled: 4000
        }
      }

      const historicalDate = new Date('2023-12-15')
      revenueService.getHistoricalData.mockResolvedValue(mockHistoricalData)
      
      const store = useRevenueStore()
      await store.loadRevenueData(historicalDate)
      
      expect(store.revenueData).toEqual(mockHistoricalData.months)
      expect(store.isHistorical).toBe(true)
      expect(store.selectedDate).toEqual(historicalDate)
    })

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to fetch revenue data'
      revenueService.getCurrentData.mockRejectedValue(new Error(errorMessage))
      
      const store = useRevenueStore()
      await store.loadRevenueData()
      
      expect(store.error).toBe(errorMessage)
      expect(store.loading).toBe(false)
      expect(store.revenueData).toEqual([])
    })

    it('should set loading state correctly', async () => {
      // Create a promise that we can control
      let resolvePromise
      const promise = new Promise(resolve => {
        resolvePromise = resolve
      })
      
      revenueService.getCurrentData.mockReturnValue(promise)
      
      const store = useRevenueStore()
      const loadPromise = store.loadRevenueData()
      
      // Check loading state is true during the request
      expect(store.loading).toBe(true)
      
      // Resolve the promise
      resolvePromise({
        months: [],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      })
      
      await loadPromise
      
      // Check loading state is false after completion
      expect(store.loading).toBe(false)
    })
  })

  describe('computed properties', () => {
    let store

    beforeEach(async () => {
      const mockData = {
        months: [{
          month: format(startOfMonth(new Date()), 'yyyy-MM-dd'), // Use actual current month
          components: {
            invoiced: 1000,
            journalEntries: 500,
            delayedCharges: 200,
            monthlyRecurring: 300,
            wonUnscheduled: 100,
            weightedSales: 150
          }
        }, {
          month: format(addMonths(startOfMonth(new Date()), 1), 'yyyy-MM-dd'),
          components: {
            invoiced: 1200,
            journalEntries: 600,
            delayedCharges: 250,
            monthlyRecurring: 350,
            wonUnscheduled: 120,
            weightedSales: 180
          }
        }, {
          month: format(addMonths(startOfMonth(new Date()), 2), 'yyyy-MM-dd'),
          components: {
            invoiced: 1100,
            journalEntries: 550,
            delayedCharges: 220,
            monthlyRecurring: 320,
            wonUnscheduled: 110,
            weightedSales: 160
          }
        }],
        exceptions: { 
          overdueDeals: [], 
          pastDelayedCharges: [], 
          wonUnscheduled: [] 
        },
        balances: { 
          assets: [
            { subType: 'Checking', balance: 10000 },
            { subType: 'Savings', balance: 5000 },
            { subType: 'Investment', balance: 20000 }
          ], 
          receivables: {
            current: 3000,
            days1to30: 2000,
            days31to60: 1000,
            days61to90: 500,
            over90: 200
          }, 
          monthlyExpenses: 5000,
          yearUnbilled: 10000,
          thirtyDaysUnbilled: 5000
        }
      }

      revenueService.getCurrentData.mockResolvedValue(mockData)
      
      store = useRevenueStore()
      await store.loadRevenueData()
    })

    it('should calculate currentMonthRevenue correctly', () => {
      // Current month should be 2024-01-01 (first month in mock data)
      // Total: 1000 + 500 + 200 + 300 + 100 + 150 = 2250
      expect(store.currentMonthRevenue).toBe(2250)
    })

    it('should calculate threeMonthRevenue correctly', () => {
      // Three months: 2250 + 2700 + 2460 = 7410
      // Month 1: 1000 + 500 + 200 + 300 + 100 + 150 = 2250
      // Month 2: 1200 + 600 + 250 + 350 + 120 + 180 = 2700  
      // Month 3: 1100 + 550 + 220 + 320 + 110 + 160 = 2460
      expect(store.threeMonthRevenue).toBe(7410)
    })

    it('should calculate totalCashOnHand correctly', () => {
      // Should include Checking (10000) + Savings (5000) = 15000
      // Investment should be excluded
      expect(store.totalCashOnHand).toBe(15000)
    })

    it('should calculate totalReceivables correctly', () => {
      // 3000 + 2000 + 1000 + 500 + 200 = 6700
      expect(store.totalReceivables).toBe(6700)
    })

    it('should calculate daysCash correctly', () => {
      // 15000 / (5000 / 30) = 15000 / 166.67 = 90 days
      expect(store.daysCash).toBe(90)
    })

    it('should calculate daysCashPlusAR correctly', () => {
      // (15000 + 6700) / (5000 / 30) = 21700 / 166.67 = 130 days
      expect(store.daysCashPlusAR).toBe(130)
    })

    it('should handle weighted sales toggle correctly', () => {
      // With weighted sales included
      expect(store.currentMonthRevenue).toBe(2250)
      
      // Toggle off weighted sales
      store.includeWeightedSales = false
      
      // Should exclude weighted sales: 2250 - 150 = 2100
      expect(store.currentMonthRevenue).toBe(2100)
    })
  })

  describe('refresh functions', () => {
    it('should refresh QuickBooks data successfully', async () => {
      const mockData = {
        months: [],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      }

      revenueService.refreshQuickbooks.mockResolvedValue({ success: true })
      revenueService.getCurrentData.mockResolvedValue(mockData)
      
      const store = useRevenueStore()
      await store.refreshQuickbooks()
      
      expect(revenueService.refreshQuickbooks).toHaveBeenCalledOnce()
      expect(revenueService.getCurrentData).toHaveBeenCalledOnce()
      expect(store.loading).toBe(false)
    })

    it('should refresh Pipedrive data successfully', async () => {
      const mockData = {
        months: [],
        exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
        balances: { assets: [], receivables: null, monthlyExpenses: 0 }
      }

      revenueService.refreshPipedrive.mockResolvedValue({ success: true })
      revenueService.getCurrentData.mockResolvedValue(mockData)
      
      const store = useRevenueStore()
      await store.refreshPipedrive()
      
      expect(revenueService.refreshPipedrive).toHaveBeenCalledOnce()
      expect(revenueService.getCurrentData).toHaveBeenCalledOnce()
      expect(store.loading).toBe(false)
    })

    it('should handle refresh errors', async () => {
      const errorMessage = 'Refresh failed'
      revenueService.refreshQuickbooks.mockRejectedValue(new Error(errorMessage))
      
      const store = useRevenueStore()
      await store.refreshQuickbooks()
      
      expect(store.error).toBe(errorMessage)
      expect(store.loading).toBe(false)
    })
  })
})
