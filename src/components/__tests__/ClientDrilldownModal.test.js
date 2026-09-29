import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ClientDrilldownModal from '../ClientDrilldownModal.vue'
import { formatWholeDollars } from '../../lib/format.js'

const ALL_TYPES = {
  invoice: true,
  journalEntry: true,
  delayedCharge: true,
  monthlyRecurring: true,
  wonUnscheduled: true,
  weightedSales: true,
}

const transaction = (id, type, client, amount, date) => ({
  id,
  type,
  customer: client,
  clientNormalized: client,
  amount,
  date,
})

function mountModal(initialTypes = ALL_TYPES) {
  return mount(ClientDrilldownModal, {
    props: {
      isOpen: true,
      client: 'Acme',
      periodLabel: 'Jan 2026 – Feb 2026',
      monthKeys: ['2026-01', '2026-02'],
      transactionsByMonth: {
        '2026-01': [
          transaction('1', 'invoice', 'Acme', 3000, '2026-01-05'),
          transaction('2', 'journalEntry', 'Acme', -1500, '2026-01-31'),
          transaction('3', 'invoice', 'Other Co', 999, '2026-01-10'),
        ],
        '2026-02': [transaction('4', 'journalEntry', 'Acme', 1500, '2026-02-01')],
      },
      initialTypes,
      formatCell: (amount) => (Math.abs(amount || 0) < 0.5 ? '' : formatWholeDollars(amount)),
      formatValue: formatWholeDollars,
    },
  })
}

const summaryCells = (wrapper) => wrapper.findAll('tbody td').map((cell) => cell.text())

describe('ClientDrilldownModal', () => {
  it('shows one summary row for the client, with a shift spread across its months', () => {
    expect(summaryCells(mountModal())).toEqual(['1,500', '1,500', '3,000'])
  })

  it('lists only this client’s transactions', () => {
    const wrapper = mountModal()
    expect(wrapper.text()).not.toContain('999')
    expect(wrapper.findAll('section')).toHaveLength(2)
  })

  it('updates the summary row and the list when a category pill is turned off', async () => {
    const wrapper = mountModal()
    const journalEntries = wrapper
      .findAll('button[aria-pressed]')
      .find((pill) => pill.text().startsWith('Journal Entries'))

    await journalEntries.trigger('click')

    expect(summaryCells(wrapper)).toEqual(['3,000', '', '3,000'])
    expect(wrapper.findAll('section')).toHaveLength(1)
  })

  it('opens with the page’s category filters', () => {
    const wrapper = mountModal({ ...ALL_TYPES, invoice: false })
    expect(summaryCells(wrapper)).toEqual(['-1,500', '1,500', '0'])
  })
})
