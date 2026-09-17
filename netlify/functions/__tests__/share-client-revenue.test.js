import { describe, it, expect } from 'vitest'

const { buildBlocks } = require('../share-client-revenue.js')

const base = {
  month: '2026-08-01',
  asOf: '2026-09-16',
  includeWeightedSales: true,
  threshold: 3000,
  pricePerPoint: 550,
  companyName: 'Buckeye Innovation',
  appUrl: 'https://forecast.buckeyeinnovation.com/?month=2026-08-01'
}

const clients = [
  { client: 'Vineyard Community Center', total: 20400 },
  { client: 'Columbus State Community College', total: 18200 },
  { client: 'New Albany Community Authority', total: 12750 },
  { client: 'Small Client A', total: 2200 },
  { client: 'Small Client B', total: 800 }
]

function textOf(blocks) {
  return blocks
    .map(b => b.text?.text || (b.elements || []).map(e => e.text).join(' '))
    .join('\n')
}

describe('share-client-revenue buildBlocks', () => {
  it('lists clients at or above the threshold individually', () => {
    const { blocks, namedCount } = buildBlocks({ ...base, clients })
    const text = textOf(blocks)

    expect(namedCount).toBe(3)
    expect(text).toContain('*Vineyard Community Center*')
    expect(text).toContain('*Columbus State Community College*')
    expect(text).not.toContain('*Small Client A*')
  })

  it('rolls up everything under the threshold into one reconciling line', () => {
    const { blocks, rolledUpCount } = buildBlocks({ ...base, clients })
    const text = textOf(blocks)

    expect(rolledUpCount).toBe(2)
    // 2200 + 800
    expect(text).toContain('＋ 2 clients under $3,000 — $3,000')
  })

  it('reports the total across ALL clients, not just the listed ones', () => {
    const { blocks, total } = buildBlocks({ ...base, clients })

    expect(total).toBe(54350)
    expect(textOf(blocks)).toContain('*Total*  $54,350')
  })

  it('sorts clients by revenue descending regardless of input order', () => {
    const shuffled = [clients[2], clients[0], clients[1], clients[4], clients[3]]
    const { blocks } = buildBlocks({ ...base, clients: shuffled })
    const text = textOf(blocks)

    expect(text.indexOf('Vineyard')).toBeLessThan(text.indexOf('Columbus State'))
    expect(text.indexOf('Columbus State')).toBeLessThan(text.indexOf('New Albany'))
  })

  it('uses the company price per point', () => {
    const { blocks } = buildBlocks({
      ...base,
      pricePerPoint: 500,
      clients: [{ client: 'Vineyard Community Center', total: 20000 }]
    })

    expect(textOf(blocks)).toContain('40.0 pts')
  })

  it('chunks a long client list across multiple section blocks under the 3000 char cap', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      client: `A Fairly Long Client Name Number ${i}`,
      total: 5000 + i
    }))
    const { blocks } = buildBlocks({ ...base, clients: many })

    const sections = blocks.filter(b => b.type === 'section')
    expect(sections.length).toBeGreaterThan(1)
    sections.forEach(section => {
      expect(section.text.text.length).toBeLessThanOrEqual(3000)
    })
    // Slack rejects messages over 50 blocks
    expect(blocks.length).toBeLessThanOrEqual(50)
  })

  it('stays within Slack limits for a pathologically long client list', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({
      client: `A Fairly Long Client Name Number ${i}`,
      total: 5000 + i
    }))
    const { blocks } = buildBlocks({ ...base, clients: many })
    const text = textOf(blocks)

    expect(blocks.length).toBeLessThanOrEqual(50)
    expect(text).toContain('＋ 300 more at or above $3,000')
  })

  it('handles a month where no client clears the threshold', () => {
    const { blocks, namedCount } = buildBlocks({
      ...base,
      clients: [{ client: 'Small Client A', total: 900 }]
    })

    expect(namedCount).toBe(0)
    expect(textOf(blocks)).toContain('No clients at or above $3,000')
  })

  it('notes when weighted sales are excluded', () => {
    const { blocks } = buildBlocks({ ...base, clients, includeWeightedSales: false })
    expect(textOf(blocks)).toContain('excludes weighted sales')
  })

  it('includes a fallback text for notifications', () => {
    const { fallback } = buildBlocks({ ...base, clients })
    expect(fallback).toBe('Client Revenue — August 2026: $54,350 across 5 clients')
  })

  it('omits the deep link when no app URL is given', () => {
    const { blocks } = buildBlocks({ ...base, clients, appUrl: null })
    expect(textOf(blocks)).not.toContain('Open the full breakdown')
  })
})
