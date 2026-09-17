import { describe, it, expect } from 'vitest'
import { csvField, toCsv } from '../csv.js'

describe('csvField', () => {
  it('leaves a plain value alone', () => {
    expect(csvField('Acme')).toBe('Acme')
    expect(csvField(1234.5)).toBe('1234.5')
  })

  it('quotes a value containing a comma', () => {
    expect(csvField('Acme, Inc.')).toBe('"Acme, Inc."')
  })

  it('doubles embedded quotes', () => {
    expect(csvField('The "Big" Deal')).toBe('"The ""Big"" Deal"')
  })

  it('quotes a value containing a newline', () => {
    expect(csvField('line one\nline two')).toBe('"line one\nline two"')
  })

  it('renders null and undefined as empty', () => {
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
  })

  it('leaves zero as zero rather than empty', () => {
    expect(csvField(0)).toBe('0')
  })
})

describe('toCsv', () => {
  it('writes a header row and the data rows', () => {
    const csv = toCsv(['Type', 'Amount'], [['Invoice', 100]])

    expect(csv).toBe('Type,Amount\nInvoice,100')
  })

  it('keeps columns aligned when a field contains a comma', () => {
    const csv = toCsv(['Client', 'Amount'], [['Acme, Inc.', 100]])

    // Four columns would mean the comma broke the row.
    expect(csv.split('\n')[1]).toBe('"Acme, Inc.",100')
  })

  it('leaves numbers unquoted so a spreadsheet reads them as numbers', () => {
    expect(toCsv(['Amount'], [[1234.56]]).split('\n')[1]).toBe('1234.56')
  })

  it('handles no rows', () => {
    expect(toCsv(['Type'], [])).toBe('Type')
  })
})
