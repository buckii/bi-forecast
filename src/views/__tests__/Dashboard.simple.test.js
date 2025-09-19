import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import Dashboard from '../Dashboard.vue'

// Mock all the dependencies
vi.mock('../../composables/useDataRefresh', () => ({
  useDataRefresh: () => ({
    refreshingQBO: { value: false },
    refreshingPipedrive: { value: false },
    qboLastRefresh: { value: null },
    pipedriveLastRefresh: { value: null },
    formatLastRefresh: vi.fn((timestamp) => timestamp ? '2h ago' : 'Never'),
    formatRefreshTooltip: vi.fn((timestamp) => timestamp ? 'Full timestamp' : 'Never refreshed'),
    refreshQBO: vi.fn(),
    refreshPipedrive: vi.fn()
  })
}))

// Create a mock store that can be modified
const mockRevenueStore = {
  loading: { value: false },
  error: { value: null },
  revenueData: [],
  includeWeightedSales: true,
  balances: { monthlyExpenses: 5000 },
  currentMonthRevenue: 0,
  threeMonthRevenue: 0,
  yearUnbilledCharges: 0,
  thirtyDaysUnbilled: 0,
  totalCashOnHand: 0,
  totalReceivables: 0,
  loadRevenueData: vi.fn()
}

vi.mock('../../stores/revenue', () => ({
  useRevenueStore: () => mockRevenueStore
}))

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    company: { value: { settings: { targetNetMargin: 20, monthlyExpensesOverride: null } } },
    token: { value: 'mock-token' }
  })
}))

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: vi.fn(() => ({
    destroy: vi.fn(),
    update: vi.fn()
  })),
  registerables: []
}))

describe('Dashboard - Simple Tests', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    
    // Reset mock store data
    mockRevenueStore.revenueData = []
    mockRevenueStore.loading = { value: false }
    mockRevenueStore.error = { value: null }
    mockRevenueStore.includeWeightedSales = true
    mockRevenueStore.balances = { monthlyExpenses: 5000 }
    mockRevenueStore.currentMonthRevenue = 0
    mockRevenueStore.threeMonthRevenue = 0
    mockRevenueStore.yearUnbilledCharges = 0
    mockRevenueStore.thirtyDaysUnbilled = 0
    mockRevenueStore.totalCashOnHand = 0
    mockRevenueStore.totalReceivables = 0
  })

  const createWrapper = () => {
    return mount(Dashboard, {
      global: {
        plugins: [pinia],
        stubs: {
          'AppLayout': {
            template: '<div class="app-layout"><slot /></div>'
          },
          'RevenueChart': {
            template: '<div data-testid="revenue-chart">Mock Chart</div>',
            props: ['data', 'monthlyExpenses', 'targetNetMargin']
          },
          'TransactionDetailsModal': {
            template: '<div data-testid="transaction-modal">Mock Modal</div>',
            props: ['isOpen', 'month', 'component']
          },
          'StatusModal': {
            template: '<div data-testid="status-modal">Mock Status Modal</div>',
            props: ['show', 'state']
          }
        }
      }
    })
  }

  describe('basic rendering', () => {
    it('should render without crashing', () => {
      const wrapper = createWrapper()
      expect(wrapper.exists()).toBe(true)
    })

    it('should render key metrics cards', () => {
      const wrapper = createWrapper()
      
      expect(wrapper.text()).toContain('This Month')
      expect(wrapper.text()).toContain('3-Month Forecast')
      expect(wrapper.text()).toContain('1-Year Unbilled')
      expect(wrapper.text()).toContain('30-Days Unbilled')
      expect(wrapper.text()).toContain('Days Cash')
      expect(wrapper.text()).toContain('Days Cash + AR')
    })

    it('should render chart section', () => {
      const wrapper = createWrapper()
      
      expect(wrapper.text()).toContain('Monthly Revenue Forecast')
      expect(wrapper.find('[data-testid="revenue-chart"]').exists()).toBe(true)
    })

    it('should render date controls', () => {
      const wrapper = createWrapper()
      
      expect(wrapper.text()).toContain('View as of')
      expect(wrapper.text()).toContain('Include weighted sales')
      // Check for the button text as it actually appears in the rendered text
      expect(wrapper.text()).toContain('Refreshing...')
      expect(wrapper.text()).toContain('QBO: 2h ago')
      expect(wrapper.text()).toContain('Pipedrive: 2h ago')
    })
  })

  describe('computed properties', () => {
    it('should calculate effective monthly expenses from company settings', () => {
      const wrapper = createWrapper()
      
      // The component should use the mocked value from auth store
      expect(wrapper.vm.effectiveMonthlyExpenses).toBe(5000)
    })

    it('should calculate target net margin from company settings', () => {
      const wrapper = createWrapper()
      
      expect(wrapper.vm.targetNetMargin).toBe(20)
    })

    it('should format currency correctly', () => {
      const wrapper = createWrapper()
      
      expect(wrapper.vm.formatCurrency(1234.56)).toBe('$1,235')
      expect(wrapper.vm.formatCurrency(0)).toBe('$0')
      expect(wrapper.vm.formatCurrency(1000000)).toBe('$1,000,000')
    })
  })

  describe('date handling functions', () => {
    it('should handle date change', () => {
      const wrapper = createWrapper()
      
      // Test that the function exists and can be called
      expect(typeof wrapper.vm.handleDateChange).toBe('function')
      
      // Set a date and call the function
      wrapper.vm.selectedDateStr = '2024-01-15'
      expect(() => wrapper.vm.handleDateChange()).not.toThrow()
    })

    it('should handle start date change', () => {
      const wrapper = createWrapper()
      
      expect(typeof wrapper.vm.handleStartDateChange).toBe('function')
      
      wrapper.vm.chartStartDateStr = '2024-01-15'
      expect(() => wrapper.vm.handleStartDateChange()).not.toThrow()
    })

    it('should handle end date change', () => {
      const wrapper = createWrapper()
      
      expect(typeof wrapper.vm.handleEndDateChange).toBe('function')
      
      wrapper.vm.chartEndDateStr = '2024-01-15'
      expect(() => wrapper.vm.handleEndDateChange()).not.toThrow()
    })

    it('should reset date range', () => {
      const wrapper = createWrapper()
      
      expect(typeof wrapper.vm.resetDateRange).toBe('function')
      expect(() => wrapper.vm.resetDateRange()).not.toThrow()
    })
  })

  describe('chart data filtering', () => {
    it('should filter chart data based on date range', () => {
      // Set up mock revenue data before creating wrapper
      mockRevenueStore.revenueData = [
        { month: '2023-12-01', components: { invoiced: 1000 } },
        { month: '2024-01-01', components: { invoiced: 1200 } },
        { month: '2024-02-01', components: { invoiced: 1300 } }
      ]
      
      const wrapper = createWrapper()
      
      // Set chart date range
      wrapper.vm.chartStartDateStr = '2024-01-01'
      wrapper.vm.chartEndDateStr = '2024-02-01'
      
      const chartData = wrapper.vm.chartData
      
      // Should filter to only include months in range
      expect(chartData).toHaveLength(2)
    })
  })

  describe('modal handling', () => {
    it('should handle bar click', () => {
      const wrapper = createWrapper()
      
      expect(typeof wrapper.vm.handleBarClick).toBe('function')
      
      const mockData = { month: '2024-01-01', component: 'invoiced', value: 1000 }
      expect(() => wrapper.vm.handleBarClick(mockData)).not.toThrow()
    })

    it('should close transaction modal', () => {
      const wrapper = createWrapper()
      
      expect(typeof wrapper.vm.closeTransactionModal).toBe('function')
      expect(() => wrapper.vm.closeTransactionModal()).not.toThrow()
    })

    it('should close share modal', () => {
      const wrapper = createWrapper()
      
      expect(typeof wrapper.vm.closeShareModal).toBe('function')
      expect(() => wrapper.vm.closeShareModal()).not.toThrow()
    })
  })
})
