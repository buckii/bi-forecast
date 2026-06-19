import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import revenueService from '../services/revenue'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import formulas from '../lib/metrics-formulas.js'

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
  
  const currentMonthKey = computed(() =>
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  )

  const currentMonthRevenue = computed(() =>
    formulas.currentMonthRevenue(
      revenueData.value,
      currentMonthKey.value,
      includeWeightedSales.value
    )
  )

  const threeMonthRevenue = computed(() =>
    formulas.threeMonthRevenue(
      revenueData.value,
      currentMonthKey.value,
      includeWeightedSales.value
    )
  )

  const yearUnbilledCharges = computed(() => balances.value.yearUnbilled || 0)

  const thirtyDaysUnbilled = computed(() =>
    formulas.thirtyDaysUnbilled(balances.value)
  )

  const totalCashOnHand = computed(() =>
    formulas.totalCashOnHand(balances.value.assets)
  )

  const daysCash = computed(() =>
    formulas.daysCash(
      totalCashOnHand.value,
      parseFloat(balances.value.monthlyExpenses) || 0
    )
  )

  const totalReceivables = computed(() =>
    formulas.totalReceivables(balances.value.receivables)
  )

  const daysCashPlusAR = computed(() =>
    formulas.daysCashPlusAR(
      totalCashOnHand.value,
      totalReceivables.value,
      parseFloat(balances.value.monthlyExpenses) || 0
    )
  )
  
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
        lastUpdated.value = null // Historical data doesn't have lastUpdated
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