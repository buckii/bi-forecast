import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../stores/revenue', () => ({
  useRevenueStore: () => ({ includeWeightedSales: true }),
}))

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ token: 'test-token', company: { settings: { pricePerPoint: 550 } } }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

vi.mock('chart.js', () => {
  const Chart = vi.fn(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
    toBase64Image: vi.fn(() => 'data:image/png;base64,x'),
  }))
  Chart.register = vi.fn()
  return { Chart, registerables: [] }
})

import TransactionDetailsModal from '../TransactionDetailsModal.vue'

const stubs = {
  JournalEntryCreateModal: { template: '<div />' },
  JournalEntryBulkEditModal: { template: '<div />' },
  JournalEntryDetailModal: { template: '<div />' },
  StatusModal: { template: '<div />' },
}

function mountModal(props = {}) {
  return mount(TransactionDetailsModal, {
    props: { isOpen: false, month: '', startDate: '', endDate: '', ...props },
    global: { plugins: [createPinia()], stubs },
  })
}

describe('TransactionDetailsModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: { transactions: [], clients: [] } }) }))
  })

  // This mounts for real. The Dashboard suite stubs this component, so a setup-time error here
  // is invisible there.
  it('mounts without throwing when closed', () => {
    expect(() => mountModal()).not.toThrow()
  })

  it('mounts with a month selected', () => {
    expect(() => mountModal({ isOpen: true, month: '2026-09-01' })).not.toThrow()
  })

  it('mounts with a date range selected', () => {
    expect(() => mountModal({ isOpen: true, startDate: '2026-09-01', endDate: '2026-11-30' })).not.toThrow()
  })

  it('exposes the filter and sort state its tabs need', () => {
    const wrapper = mountModal()

    expect(wrapper.vm.enabledTypes).toBeTruthy()
    expect(wrapper.vm.clientEnabledTypes).toBeTruthy()
    expect(wrapper.vm.sortBy).toBe('amount')
    expect(typeof wrapper.vm.toggleSort).toBe('function')
    expect(typeof wrapper.vm.exportToCSV).toBe('function')
  })

  it('keeps the two tabs’ filters independent', async () => {
    const wrapper = mountModal()

    wrapper.vm.toggleAllFilters()
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.allFiltersEnabled).toBe(false)
    expect(wrapper.vm.allClientFiltersEnabled).toBe(true)
  })
})
