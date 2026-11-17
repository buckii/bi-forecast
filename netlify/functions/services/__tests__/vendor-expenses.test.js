import { describe, expect, it } from 'vitest'
import { parseVendorExpensesReport, periodDates, validatePeriod } from '../vendor-expenses.js'

const monthColumn = (title, start, end) => ({
  ColTitle: title,
  ColType: 'Money',
  MetaData: [
    { Name: 'StartDate', Value: start },
    { Name: 'EndDate', Value: end },
    { Name: 'ColKey', Value: title },
  ],
})

const vendorRow = (name, id, ...amounts) => ({ ColData: [{ value: name, id }, ...amounts.map((value) => ({ value }))] })

// The shape QuickBooks returns: data rows with no `type`, then a GrandTotal section.
const report = {
  Columns: {
    Column: [
      { ColTitle: '', ColType: 'Vendor' },
      monthColumn('Aug 2026', '2026-08-01', '2026-08-31'),
      monthColumn('Sep 2026', '2026-09-01', '2026-09-30'),
      { ColTitle: 'Total', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'total' }] },
    ],
  },
  Rows: {
    Row: [
      vendorRow('Office Rent Co', '12', '2500.00', '2500.00', '5000.00'),
      vendorRow('Software Inc', '34', '', '1,200.50', '1200.50'),
      vendorRow('Refunding Vendor', '56', '-80.00', '', '-80.00'),
      vendorRow('Quiet Vendor', '78', '', '0.00', ''),
      { ColData: [{ value: 'Not Specified' }, { value: '10.00' }, { value: '' }, { value: '10.00' }] },
      { type: 'Section', group: 'GrandTotal', Summary: { ColData: [{ value: 'TOTAL' }] } },
    ],
  },
}

describe('parseVendorExpensesReport', () => {
  const { monthKeys, vendors } = parseVendorExpensesReport(report)
  const byName = Object.fromEntries(vendors.map((vendor) => [vendor.vendor, vendor]))

  it('reads month keys from the column start dates and leaves out the Total column', () => {
    expect(monthKeys).toEqual(['2026-08', '2026-09'])
  })

  it('puts each amount under its month and totals the row', () => {
    expect(byName['Office Rent Co']).toEqual({
      vendor: 'Office Rent Co',
      vendorId: '12',
      months: { '2026-08': 2500, '2026-09': 2500 },
      total: 5000,
    })
    expect(byName['Software Inc'].months).toEqual({ '2026-09': 1200.5 })
  })

  it('keeps a credit as a negative amount', () => {
    expect(byName['Refunding Vendor'].total).toBe(-80)
  })

  it('drops a vendor with nothing in any month, and the grand total row', () => {
    expect(byName['Quiet Vendor']).toBeUndefined()
    expect(byName.TOTAL).toBeUndefined()
  })

  it('keeps spending with no vendor attached', () => {
    expect(byName['Not Specified'].vendorId).toBeNull()
  })

  it('throws on a report with no columns', () => {
    expect(() => parseVendorExpensesReport({})).toThrow(/no columns/)
  })
})

describe('validatePeriod', () => {
  it('accepts a range up to 24 months', () => {
    expect(validatePeriod('2025-01', '2026-12')).toBeNull()
  })

  it('rejects a longer range, a reversed range, and a full date', () => {
    expect(validatePeriod('2025-01', '2027-01')).toMatch(/24 months/)
    expect(validatePeriod('2026-05', '2026-04')).toMatch(/before/)
    expect(validatePeriod('2026-05-01', '2026-06')).toMatch(/YYYY-MM/)
  })
})

describe('periodDates', () => {
  it('runs from the first of the start month to the last day of the end month, leap years included', () => {
    expect(periodDates('2027-11', '2028-02')).toEqual({ startDate: '2027-11-01', endDate: '2028-02-29' })
  })
})
