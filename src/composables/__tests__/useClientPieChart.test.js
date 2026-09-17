import { describe, it, expect } from 'vitest'
import { toPieSlices } from '../useClientPieChart.js'

const clients = (count) =>
  Array.from({ length: count }, (_, index) => ({ client: `Client ${index + 1}`, total: (count - index) * 100 }))

describe('toPieSlices', () => {
  it('shows every client when there are few enough', () => {
    expect(toPieSlices(clients(4))).toHaveLength(4)
  })

  it('shows ten clients without a rollup', () => {
    const slices = toPieSlices(clients(10))

    expect(slices).toHaveLength(10)
    expect(slices.some((slice) => slice.client.startsWith('Other'))).toBe(false)
  })

  it('rolls the remainder into one slice', () => {
    const slices = toPieSlices(clients(14))

    expect(slices).toHaveLength(11)
    expect(slices[10].client).toBe('Other Clients (4)')
  })

  it('keeps the rollup total equal to what it replaced', () => {
    const all = clients(14)
    const slices = toPieSlices(all)

    const rolledUp = all.slice(10).reduce((sum, client) => sum + client.total, 0)
    expect(slices[10].total).toBe(rolledUp)
  })

  it('preserves the grand total', () => {
    const all = clients(25)
    const total = all.reduce((sum, client) => sum + client.total, 0)

    expect(toPieSlices(all).reduce((sum, slice) => sum + slice.total, 0)).toBe(total)
  })

  it('handles an empty list', () => {
    expect(toPieSlices([])).toEqual([])
  })
})
