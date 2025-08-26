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
    receivables: null
  })
  
  const includeWeightedSales = ref(true)
  
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
    const start = startOfMonth(new Date())
    let total = 0
    
    for (let i = 0; i < 12; i++) {
      const month = format(addMonths(start, i), 'yyyy-MM-dd')
      const monthData = revenueData.value.find(m => m.month === month)
      if (monthData) {
        total += monthData.components.delayedCharges
      }
    }
    
    return total
  })
  
  async function loadRevenueData(date = null) {
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
        const response = await revenueService.getCurrentData()
        revenueData.value = response.months
        exceptions.value = response.exceptions
        balances.value = response.balances
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
      await loadRevenueData()
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
      await loadRevenueData()
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
    currentMonthRevenue,
    threeMonthRevenue,
    yearUnbilledCharges,
    loadRevenueData,
    refreshQuickbooks,
    refreshPipedrive
  }
})