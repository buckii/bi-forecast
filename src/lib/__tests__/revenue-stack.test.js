import { describe, expect, it } from 'vitest'
import { stackRevenue } from '../revenue-stack.js'

const KEYS = ['invoiced', 'journalEntries', 'delayedCharges', 'monthlyRecurring', 'weightedSales']

describe('stackRevenue', () => {
  it('stacks from zero when nothing is negative', () => {
    const { segments, base, net } = stackRevenue({ invoiced: 100, delayedCharges: 50 }, KEYS)
    expect(base).toBe(0)
    expect(net).toBe(150)
    expect(segments.invoiced).toEqual([0, 100])
    expect(segments.delayedCharges).toEqual([100, 150])
  })

  it('lowers the base by the negatives so the top is the net total', () => {
    const month = {
      invoiced: 0,
      journalEntries: -82041,
      delayedCharges: 161074,
      monthlyRecurring: 54775,
      weightedSales: 87383,
    }
    const { segments, base, net } = stackRevenue(month, KEYS)
    expect(base).toBe(-82041)
    expect(net).toBe(221191)
    expect(segments.journalEntries).toEqual([-82041, 0])
    expect(segments.invoiced).toEqual([-82041, -82041])
    expect(segments.delayedCharges).toEqual([-82041, 79033])
    expect(segments.weightedSales[1]).toBe(net)
  })

  it('stacks several negatives downward from zero', () => {
    const { segments, base } = stackRevenue({ invoiced: -10, journalEntries: -30, delayedCharges: 100 }, KEYS)
    expect(segments.invoiced).toEqual([-10, 0])
    expect(segments.journalEntries).toEqual([-40, -10])
    expect(base).toBe(-40)
  })

  it('leaves out keys that are not passed, so a hidden type drops from the stack', () => {
    const { segments, base, net } = stackRevenue({ journalEntries: -50, delayedCharges: 100 }, ['delayedCharges'])
    expect(segments.journalEntries).toBeUndefined()
    expect(base).toBe(0)
    expect(net).toBe(100)
  })
})
