import { describe, it, expect } from 'vitest'
import { detectPairs } from '../journal-entry-pairs.js'

let nextId = 1

function entry({ date, posting, amount = 5000, description = 'Acme Corp', revenueAccount = '4010' }) {
  return {
    Id: String(nextId++),
    TxnDate: date,
    Line: [
      {
        Amount: amount,
        Description: description,
        JournalEntryLineDetail: {
          PostingType: posting,
          AccountRef: { name: 'Unearned Revenue', value: '2100' }
        }
      },
      {
        Amount: amount,
        Description: description,
        JournalEntryLineDetail: {
          PostingType: posting === 'Debit' ? 'Credit' : 'Debit',
          AccountRef: { name: 'Project Income', value: revenueAccount }
        }
      }
    ]
  }
}

describe('detectPairs', () => {
  it('pairs two entries that cancel out in unearned revenue', () => {
    const { paired, unpaired } = detectPairs([
      entry({ date: '2026-06-01', posting: 'Credit' }),
      entry({ date: '2026-07-01', posting: 'Debit' })
    ])

    expect(unpaired).toHaveLength(0)
    expect(paired).toHaveLength(1)
    expect(paired[0].netEffect).toEqual({ fromMonth: '2026-06', toMonth: '2026-07', amount: 5000 })
  })

  it('leaves a lone entry unpaired', () => {
    const { paired, unpaired } = detectPairs([entry({ date: '2026-06-01', posting: 'Credit' })])

    expect(paired).toHaveLength(0)
    expect(unpaired).toHaveLength(1)
  })

  it('does not pair entries posting the same direction', () => {
    const { paired } = detectPairs([
      entry({ date: '2026-06-01', posting: 'Credit' }),
      entry({ date: '2026-07-01', posting: 'Credit' })
    ])

    expect(paired).toHaveLength(0)
  })

  it('does not pair entries for different amounts', () => {
    const { paired } = detectPairs([
      entry({ date: '2026-06-01', posting: 'Credit', amount: 5000 }),
      entry({ date: '2026-07-01', posting: 'Debit', amount: 4000 })
    ])

    expect(paired).toHaveLength(0)
  })

  it('does not pair entries for different clients', () => {
    const { paired } = detectPairs([
      entry({ date: '2026-06-01', posting: 'Credit', description: 'Acme Corp' }),
      entry({ date: '2026-07-01', posting: 'Debit', description: 'Globex' })
    ])

    expect(paired).toHaveLength(0)
  })

  it('does not pair entries hitting different revenue accounts', () => {
    const { paired } = detectPairs([
      entry({ date: '2026-06-01', posting: 'Credit', revenueAccount: '4010' }),
      entry({ date: '2026-07-01', posting: 'Debit', revenueAccount: '4020' })
    ])

    expect(paired).toHaveLength(0)
  })

  it('does not pair entries more than 60 days apart', () => {
    const { paired } = detectPairs([
      entry({ date: '2026-01-01', posting: 'Credit' }),
      entry({ date: '2026-06-01', posting: 'Debit' })
    ])

    expect(paired).toHaveLength(0)
  })

  it('never uses one entry in two pairs', () => {
    const { paired, unpaired } = detectPairs([
      entry({ date: '2026-06-01', posting: 'Credit' }),
      entry({ date: '2026-07-01', posting: 'Debit' }),
      entry({ date: '2026-07-15', posting: 'Debit' })
    ])

    expect(paired).toHaveLength(1)
    expect(unpaired).toHaveLength(1)
  })

  it('treats an entry with no revenue line as unpairable', () => {
    const orphan = {
      Id: '99',
      TxnDate: '2026-06-01',
      Line: [
        {
          Amount: 100,
          Description: 'Acme Corp',
          JournalEntryLineDetail: {
            PostingType: 'Credit',
            AccountRef: { name: 'Unearned Revenue', value: '2100' }
          }
        }
      ]
    }

    const { paired, unpaired } = detectPairs([orphan])

    expect(paired).toHaveLength(0)
    expect(unpaired).toHaveLength(1)
  })
})
