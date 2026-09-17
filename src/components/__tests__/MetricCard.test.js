import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MetricCard from '../MetricCard.vue'

const base = { title: 'This Month', value: 1234 }

describe('MetricCard', () => {
  it('shows the formatted value', () => {
    const wrapper = mount(MetricCard, { props: base })

    expect(wrapper.text()).toContain('This Month')
    expect(wrapper.text()).toContain('$1,234')
  })

  it('replaces the value with an em dash while loading', () => {
    const wrapper = mount(MetricCard, { props: { ...base, loading: true } })

    expect(wrapper.text()).toContain('—')
    expect(wrapper.text()).not.toContain('$1,234')
  })

  it('announces loading to screen readers', () => {
    const wrapper = mount(MetricCard, { props: { ...base, loading: true } })
    const status = wrapper.find('[role="status"]')

    expect(status.attributes('aria-busy')).toBe('true')
    expect(status.text()).toContain('Loading This Month')
  })

  it('emits no comparison markup when there is nothing to compare', () => {
    const wrapper = mount(MetricCard, { props: base })

    expect(wrapper.text()).not.toContain('As of')
  })

  it('shows a gain in green with a plus sign', () => {
    const wrapper = mount(MetricCard, {
      props: { ...base, value: 150, comparison: 100, comparisonLabel: 'Sep 1, 2026' },
    })

    expect(wrapper.text()).toContain('As of Sep 1, 2026')
    expect(wrapper.text()).toContain('$100')
    expect(wrapper.text()).toContain('+$50')
    expect(wrapper.text()).toContain('+50.0%')
    expect(wrapper.find('.text-green-600').exists()).toBe(true)
  })

  it('shows a loss in red', () => {
    const wrapper = mount(MetricCard, { props: { ...base, value: 50, comparison: 100 } })

    expect(wrapper.text()).toContain('-$50')
    expect(wrapper.text()).toContain('-50.0%')
    expect(wrapper.find('.text-red-600').exists()).toBe(true)
  })

  it('treats a zero comparison as no percent change rather than infinity', () => {
    const wrapper = mount(MetricCard, { props: { ...base, value: 100, comparison: 0 } })

    expect(wrapper.text()).toContain('0.0%')
    expect(wrapper.text()).not.toContain('Infinity')
  })

  it('compares against zero rather than hiding the column', () => {
    const wrapper = mount(MetricCard, { props: { ...base, value: 100, comparison: 0, comparisonLabel: 'Aug 1' } })

    expect(wrapper.text()).toContain('As of Aug 1')
  })

  it('emits no footnote wrapper when no footnote is given', () => {
    const wrapper = mount(MetricCard, { props: base })

    expect(wrapper.find('.space-y-0\\.5').exists()).toBe(false)
  })

  it('renders a footnote when given one', () => {
    const wrapper = mount(MetricCard, {
      props: base,
      slots: { footnote: '<p>Est. Profit: $500</p>' },
    })

    expect(wrapper.text()).toContain('Est. Profit: $500')
  })

  it('lets the default slot replace the value', () => {
    const wrapper = mount(MetricCard, { props: base, slots: { default: '<span>custom body</span>' } })

    expect(wrapper.text()).toContain('custom body')
    expect(wrapper.text()).not.toContain('$1,234')
  })
})
