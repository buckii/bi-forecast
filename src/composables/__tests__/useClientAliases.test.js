import { describe, it, expect } from 'vitest'
import { parseAliases, toAliasPayload } from '../useClientAliases.js'

describe('parseAliases', () => {
  it('splits a comma-separated list', () => {
    expect(parseAliases('Acme, Acme Inc, ACME')).toEqual(['Acme', 'Acme Inc', 'ACME'])
  })

  it('drops empty entries left by stray commas', () => {
    expect(parseAliases('Acme,, ,Globex,')).toEqual(['Acme', 'Globex'])
  })

  it('returns nothing for an empty field', () => {
    expect(parseAliases('')).toEqual([])
    expect(parseAliases(undefined)).toEqual([])
  })
})

describe('toAliasPayload', () => {
  it('keeps only clients that have a primary name', () => {
    const payload = toAliasPayload([
      { primaryName: 'Acme', aliases: 'Acme Inc' },
      { primaryName: '   ', aliases: 'ignored' },
    ])

    expect(payload).toEqual([{ primaryName: 'Acme', aliases: ['Acme Inc'] }])
  })

  it('trims the primary name', () => {
    expect(toAliasPayload([{ primaryName: '  Acme  ', aliases: '' }])).toEqual([{ primaryName: 'Acme', aliases: [] }])
  })

  it('handles a client with no aliases', () => {
    expect(toAliasPayload([{ primaryName: 'Acme', aliases: '' }])).toEqual([{ primaryName: 'Acme', aliases: [] }])
  })
})
