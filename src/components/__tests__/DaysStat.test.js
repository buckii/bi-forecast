import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DaysStat from '../DaysStat.vue'

describe('DaysStat', () => {
  it('shows the day count and its label', () => {
    const wrapper = mount(DaysStat, { props: { label: 'Cash only', value: 350 } })

    expect(wrapper.text()).toContain('350')
    expect(wrapper.text()).toContain('Cash only')
  })

  it('reads zero days as an em dash rather than "0"', () => {
    const wrapper = mount(DaysStat, { props: { label: 'Cash only', value: 0 } })

    expect(wrapper.text()).toContain('—')
  })

  it('shows an em dash while loading', () => {
    const wrapper = mount(DaysStat, { props: { label: 'Cash only', value: 350, loading: true } })

    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).not.toContain('350')
  })

  it('shows the dollar figure behind the count when given one', () => {
    const wrapper = mount(DaysStat, { props: { label: 'Cash only', value: 350, amount: 35000 } })

    expect(wrapper.text()).toContain('$35,000')
  })

  it('omits the dollar figure when there is none', () => {
    const wrapper = mount(DaysStat, { props: { label: 'Won', value: 120 } })

    expect(wrapper.text()).not.toContain('$')
  })

  it('shows the change in days against a comparison', () => {
    const wrapper = mount(DaysStat, { props: { label: 'Cash only', value: 350, comparison: 300 } })

    expect(wrapper.text()).toContain('+50 days')
    expect(wrapper.find('.text-green-600').exists()).toBe(true)
  })

  it('shows a decline in red', () => {
    const wrapper = mount(DaysStat, { props: { label: 'Cash only', value: 250, comparison: 300 } })

    expect(wrapper.text()).toContain('-50 days')
    expect(wrapper.find('.text-red-600').exists()).toBe(true)
  })

  it('emits no comparison markup when there is nothing to compare', () => {
    const wrapper = mount(DaysStat, { props: { label: 'Cash only', value: 350 } })

    expect(wrapper.text()).not.toContain('days')
  })
})
