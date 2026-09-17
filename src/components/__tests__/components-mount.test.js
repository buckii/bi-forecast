import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, params: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

vi.mock('chart.js', () => {
  const Chart = vi.fn(() => ({ destroy: vi.fn(), update: vi.fn(), toBase64Image: vi.fn() }))
  Chart.register = vi.fn()
  return { Chart, registerables: [] }
})

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({ token: 'test-token', company: { settings: { pricePerPoint: 550 } } }),
}))

vi.mock('../../stores/revenue', () => ({
  useRevenueStore: () => ({ includeWeightedSales: true, revenueData: [], balances: {} }),
}))

import AsOfDateSelector from '../AsOfDateSelector.vue'
import JournalEntryBulkEditModal from '../JournalEntryBulkEditModal.vue'
import JournalEntryCreateModal from '../JournalEntryCreateModal.vue'
import JournalEntryDetailModal from '../JournalEntryDetailModal.vue'
import JournalEntryPair from '../JournalEntryPair.vue'
import PaymentModal from '../PaymentModal.vue'
import StatusModal from '../StatusModal.vue'
import ToastContainer from '../ToastContainer.vue'

const entry = {
  Id: '1',
  TxnDate: '2026-09-01',
  PrivateNote: 'Revenue spreading - Acme',
  Line: [
    {
      Amount: 450,
      Description: 'Acme',
      JournalEntryLineDetail: { PostingType: 'Debit', AccountRef: { name: 'Unearned Revenue', value: '246' } },
    },
  ],
}

const components = [
  ['AsOfDateSelector', AsOfDateSelector, { modelValue: '2026-09-01' }],
  ['JournalEntryBulkEditModal', JournalEntryBulkEditModal, { isOpen: false, entryId: null }],
  ['JournalEntryCreateModal', JournalEntryCreateModal, { isOpen: false }],
  ['JournalEntryDetailModal', JournalEntryDetailModal, { isOpen: false, entry }],
  [
    'JournalEntryPair',
    JournalEntryPair,
    {
      pair: {
        pairId: '1-2',
        amount: 450,
        description: 'Acme',
        debitEntry: entry,
        creditEntry: entry,
        netEffect: { fromMonth: '2026-09', toMonth: '2026-10', amount: 450 },
      },
    },
  ],
  ['PaymentModal', PaymentModal, { isOpen: false, invoice: { balance: 100, customerName: 'Acme' } }],
  ['StatusModal', StatusModal, { show: false, state: 'loading' }],
  ['ToastContainer', ToastContainer, {}],
]

describe('components mount', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: {} }) }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it.each(components)('%s renders without throwing', (_name, component, props) => {
    expect(() => mount(component, { props, global: { plugins: [createPinia()] } })).not.toThrow()
  })
})
