import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import revenueService from '../services/revenue'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'

export const useRevenueStore = defineStore('revenue', () => {
  const selectedDate = ref(new Date())
  const isHistorical = ref(false)
  const loading = ref(false)
  const error = ref(null)
  
  const revenueData = ref([])
  const exceptions = ref({
    overdueDeals: [],
    pastDelayedCharges: [],
    wonUnscheduled: []
  })
  const balances = ref({
    assets: [],
    receivables: null,
    monthlyExpenses: 0
  })
  
  const includeWeightedSales = ref(true)
  const lastUpdated = ref(null)
  
  const currentMonthRevenue = computed(() => {
    const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthData = revenueData.value.find(m => m.month === currentMonth)
    if (!monthData) return 0
    
    const components = monthData.components
    let total = components.invoiced + components.journalEntries + 
                components.delayedCharges + components.monthlyRecurring + 
                components.wonUnscheduled
    
    if (includeWeightedSales.value) {
      total += components.weightedSales
    }
    
    return total
  })
  
  const threeMonthRevenue = computed(() => {
    const start = startOfMonth(new Date())
    let total = 0
    
    for (let i = 0; i < 3; i++) {
      const month = format(addMonths(start, i), 'yyyy-MM-dd')
      const monthData = revenueData.value.find(m => m.month === month)
      if (monthData) {
        const components = monthData.components
        total += components.invoiced + components.journalEntries + 
                 components.delayedCharges + components.monthlyRecurring + 
                 components.wonUnscheduled
        
        if (includeWeightedSales.value) {
          total += components.weightedSales
        }
      }
    }
    
    return total
  })
  
  const yearUnbilledCharges = computed(() => {
    // Get the pre-calculated value from backend balances
    return balances.value.yearUnbilled || 0
  })

  const thirtyDaysUnbilled = computed(() => {
    // Get the pre-calculated value from backend balances
    return balances.value.thirtyDaysUnbilled || 0
  })

  const totalCashOnHand = computed(() => {
    if (!balances.value.assets || !Array.isArray(balances.value.assets)) {
      return 0
    }
    
    return balances.value.assets.reduce((total, account) => {
      if (['Checking', 'Savings', 'UndepositedFunds'].includes(account.subType)) {
        const balance = parseFloat(account.balance) || 0
        return total + balance
      }
      return total
    }, 0)
  })

  const daysCash = computed(() => {
    const monthlyExpenses = parseFloat(balances.value.monthlyExpenses) || 0
    const dailyExpenses = monthlyExpenses / 30
    const cashOnHand = totalCashOnHand.value
    
    
    if (dailyExpenses === 0 || cashOnHand === 0) return 0
    return Math.round(cashOnHand / dailyExpenses)
  })

  const totalReceivables = computed(() => {
    if (!balances.value.receivables) return 0
    
    // Handle different receivables data structures
    if (typeof balances.value.receivables === 'number') {
      return balances.value.receivables
    }
    
    if (balances.value.receivables.total !== undefined) {
      return balances.value.receivables.total
    }
    
    // If it's an object with aging buckets, sum them up
    if (balances.value.receivables.current !== undefined) {
      return (balances.value.receivables.current || 0) +
             (balances.value.receivables.days1to30 || 0) +
             (balances.value.receivables.days31to60 || 0) +
             (balances.value.receivables.days61to90 || 0) +
             (balances.value.receivables.over90 || 0)
    }
    
    return 0
  })

  const daysCashPlusAR = computed(() => {
    const monthlyExpenses = parseFloat(balances.value.monthlyExpenses) || 0
    const dailyExpenses = monthlyExpenses / 30
    if (dailyExpenses === 0) return 0
    const totalLiquid = totalCashOnHand.value + totalReceivables.value
    if (totalLiquid === 0) return 0
    return Math.round(totalLiquid / dailyExpenses)
  })
  
  async function loadRevenueData(date = null, bypassCache = false) {
    loading.value = true
    error.value = null
    
    try {
      if (date) {
        selectedDate.value = date
        isHistorical.value = true
        const response = await revenueService.getHistoricalData(date)
        revenueData.value = response.months
        exceptions.value = response.exceptions
        balances.value = response.balances
      } else {
        selectedDate.value = new Date()
        isHistorical.value = false
        const response = await revenueService.getCurrentData(bypassCache)
        revenueData.value = response.months
        exceptions.value = response.exceptions
        balances.value = response.balances
        lastUpdated.value = response.lastUpdated
      }
    } catch (err) {
      error.value = err.message
      console.error('Failed to load revenue data:', err)
    } finally {
      loading.value = false
    }
  }
  
  async function refreshQuickbooks() {
    loading.value = true
    try {
      await revenueService.refreshQuickbooks()
      await loadRevenueData(null, true) // Bypass cache after refresh
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }
  
  async function refreshPipedrive() {
    loading.value = true
    try {
      await revenueService.refreshPipedrive()
      await loadRevenueData(null, true) // Bypass cache after refresh
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }
  
  return {
    selectedDate,
    isHistorical,
    loading,
    error,
    revenueData,
    exceptions,
    balances,
    includeWeightedSales,
    lastUpdated,
    currentMonthRevenue,
    threeMonthRevenue,
    yearUnbilledCharges,
    thirtyDaysUnbilled,
    totalCashOnHand,
    daysCash,
    totalReceivables,
    daysCashPlusAR,
    loadRevenueData,
    refreshQuickbooks,
    refreshPipedrive
  }
})