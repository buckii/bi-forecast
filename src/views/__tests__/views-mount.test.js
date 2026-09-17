import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// A setup-time error in a view is invisible to every other suite, because nothing else mounts
// these. Each case here only asserts that the view renders at all.

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, params: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('chart.js', () => {
  const Chart = vi.fn(() => ({ destroy: vi.fn(), update: vi.fn(), toBase64Image: vi.fn() }))
  Chart.register = vi.fn()
  return { Chart, registerables: [] }
})

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    token: 'test-token',
    user: { email: 'someone@example.com', role: 'admin' },
    company: { name: 'Acme', settings: { targetNetMargin: 20, pricePerPoint: 550 } },
    fetchCurrentUser: vi.fn(),
    isAuthenticated: true,
  }),
}))

vi.mock('../../stores/revenue', () => ({
  useRevenueStore: () => ({
    loading: false,
    error: null,
    revenueData: [],
    includeWeightedSales: true,
    balances: { monthlyExpenses: 5000, assets: [], receivables: null },
    exceptions: { overdueDeals: [], pastDelayedCharges: [], wonUnscheduled: [] },
    currentMonthRevenue: 0,
    threeMonthRevenue: 0,
    yearUnbilledCharges: 0,
    thirtyDaysUnbilled: 0,
    totalCashOnHand: 0,
    totalReceivables: 0,
    lastUpdated: null,
    loadRevenueData: vi.fn(),
  }),
}))

import AccountsReceivable from '../AccountsReceivable.vue'
import Balances from '../Balances.vue'
import Exceptions from '../Exceptions.vue'
import JournalEntries from '../JournalEntries.vue'
import Login from '../Login.vue'
import Settings from '../Settings.vue'
import Users from '../Users.vue'

const stubs = {
  AppLayout: { template: '<div><slot /></div>' },
  AsOfDateSelector: { template: '<div />' },
  PaymentModal: { template: '<div />' },
  ToastContainer: { template: '<div />' },
  RevenueChart: { template: '<div />' },
  StatusModal: { template: '<div />' },
  TransactionDetailsModal: { template: '<div />' },
  JournalEntryCreateModal: { template: '<div />' },
  JournalEntryBulkEditModal: { template: '<div />' },
  JournalEntryDetailModal: { template: '<div />' },
  JournalEntryPair: { template: '<div />' },
  RouterLink: { template: '<a><slot /></a>' },
}

const views = [
  ['AccountsReceivable', AccountsReceivable],
  ['Balances', Balances],
  ['Exceptions', Exceptions],
  ['JournalEntries', JournalEntries],
  ['Login', Login],
  ['Settings', Settings],
  ['Users', Users],
]

describe('views mount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it.each(views)('%s renders without throwing', (_name, view) => {
    expect(() => mount(view, { global: { plugins: [createPinia()], stubs } })).not.toThrow()
  })
})
