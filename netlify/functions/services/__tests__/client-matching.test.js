import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../utils/database.js', () => ({
  getCollection: vi.fn(),
}))

const RevenueCalculator = require('../revenue-calculator.js')

describe('client matching for journal entries', () => {
  let calculator

  beforeEach(() => {
    calculator = new RevenueCalculator('company-1')
    // Aliases configured for some clients, but not Vineyard or Sulam
    calculator.clientAliasesMap = {
      'columbus state community college': 'Columbus State Community College',
      cscc: 'Columbus State Community College',
    }
    calculator.clientNamesMap = {}
  })

  it('matches a client with no alias record by exact name in the description', () => {
    calculator.registerClientName('Vineyard Community Center')

    expect(calculator.matchClientFromText('Vineyard Community Center monthly share Invoice 126164')).toBe(
      'Vineyard Community Center',
    )
  })

  it('still matches via client aliases', () => {
    expect(calculator.matchClientFromText('CSCC 4 pts invoiced Aug 2026')).toBe('Columbus State Community College')
  })

  it('prefers the longest candidate so a shorter name is not a false positive', () => {
    calculator.registerClientName('Vineyard')
    calculator.registerClientName('Vineyard Community Center')

    expect(calculator.matchClientFromText('Vineyard Community Center monthly share')).toBe('Vineyard Community Center')
  })

  it('resolves an exact name that is itself an alias to the primary name', () => {
    calculator.clientAliasesMap['the vineyard'] = 'Vineyard Community Center'
    calculator.registerClientName('The Vineyard')

    expect(calculator.matchClientFromText('The Vineyard monthly share')).toBe('Vineyard Community Center')
  })

  it('ignores very short names that would false-positive inside free text', () => {
    calculator.registerClientName('ABC')

    expect(calculator.clientNamesMap['abc']).toBeUndefined()
    expect(calculator.matchClientFromText('Prepaid ABC support hours')).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(calculator.matchClientFromText('Year end adjustment')).toBeNull()
    expect(calculator.matchClientFromText('')).toBeNull()
  })

  it('registers names from already-fetched QBO and Pipedrive data', () => {
    calculator.registerClientNamesFromData(
      {
        invoices: [{ CustomerRef: { name: 'Vineyard Community Center' } }],
        delayedCharges: [{ CustomerRef: { name: 'New Albany Community Authority' } }],
      },
      {
        wonUnscheduledDeals: [{ orgName: 'Sulam Academy' }],
        openDeals: [{ orgName: 'Buckeye Ranch' }],
      },
    )

    expect(calculator.matchClientFromText('Sulam Academy 7.5 pts invoiced Aug 2026, done Sep 2026')).toBe(
      'Sulam Academy',
    )
    expect(calculator.matchClientFromText('New Albany Community Authority monthly share')).toBe(
      'New Albany Community Authority',
    )
  })
})
