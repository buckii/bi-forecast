import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MonthRangePicker from '../MonthRangePicker.vue'

function mountPicker(start = '2026-01', end = '2026-12') {
  return mount(MonthRangePicker, { props: { start, end } })
}

const lastUpdate = (wrapper) => [wrapper.emitted('update:start').at(-1)[0], wrapper.emitted('update:end').at(-1)[0]]
const pill = (wrapper, label) => wrapper.findAll('button[aria-pressed]').find((button) => button.text() === label)

async function openQuickRanges(wrapper) {
  await wrapper
    .findAll('button')
    .find((button) => button.text().includes('Quick ranges'))
    .trigger('click')
}

describe('MonthRangePicker quick ranges', () => {
  it('opens on the year the period starts in, with that period marked', async () => {
    const wrapper = mountPicker('2025-01', '2025-12')
    await openQuickRanges(wrapper)

    expect(wrapper.text()).toContain('2025')
    expect(pill(wrapper, 'Full year').attributes('aria-pressed')).toBe('true')
  })

  it('sets a quarter', async () => {
    const wrapper = mountPicker()
    await openQuickRanges(wrapper)
    await pill(wrapper, 'Q2 · Apr–Jun').trigger('click')

    expect(lastUpdate(wrapper)).toEqual(['2026-04', '2026-06'])
  })

  it('sets a single month in another year', async () => {
    const wrapper = mountPicker()
    await openQuickRanges(wrapper)
    await wrapper.find('button[aria-label="Next year"]').trigger('click')
    await pill(wrapper, 'Mar 27').trigger('click')

    expect(lastUpdate(wrapper)).toEqual(['2027-03', '2027-03'])
  })
})

describe('MonthRangePicker arrows', () => {
  it('steps a quarter by a quarter', async () => {
    const wrapper = mountPicker('2026-04', '2026-06')
    await wrapper.find('button[aria-label="Next period"]').trigger('click')

    expect(lastUpdate(wrapper)).toEqual(['2026-07', '2026-09'])
  })
})
