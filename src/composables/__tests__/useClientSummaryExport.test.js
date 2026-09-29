import { describe, expect, it } from 'vitest'
import { clientSummaryExportName, clientSummaryTable } from '../useClientSummaryExport.js'

const base = {
  rows: [
    { client: 'Acme', months: { '2026-01': 1100, '2026-02': 1100.004 }, total: 2200.004 },
    { client: 'Beta', months: { '2026-02': 550 }, total: 550 },
  ],
  monthKeys: ['2026-01', '2026-02'],
  monthTotals: { '2026-01': 1100, '2026-02': 1650.004 },
  grandTotal: 2750.004,
  pricePerPoint: 550,
}

describe('clientSummaryTable', () => {
  it('keeps dollars to the cent and leaves empty months blank', () => {
    const { headers, tableRows } = clientSummaryTable({ ...base, isPoints: false })

    expect(headers).toEqual(['Client', 'Jan 2026', 'Feb 2026', 'Total', '% of Total'])
    expect(tableRows[0]).toEqual(['Acme', 1100, 1100, 2200, 80])
    expect(tableRows[1]).toEqual(['Beta', '', 550, 550, 20])
  })

  it('converts to points at the price per point', () => {
    const { headers, tableRows } = clientSummaryTable({ ...base, isPoints: true })

    expect(headers[3]).toBe('Total (points)')
    expect(tableRows[0]).toEqual(['Acme', 2, 2, 4, 80])
  })

  it('ends with a total row at 100%', () => {
    const { tableRows } = clientSummaryTable({ ...base, isPoints: false })
    expect(tableRows.at(-1)).toEqual(['TOTAL', 1100, 1650, 2750, 100])
  })

  it('gives each column a number format, with text for the client names', () => {
    const { columnPatterns } = clientSummaryTable({ ...base, isPoints: false })
    expect(columnPatterns).toEqual([null, '#,##0.00', '#,##0.00', '#,##0.00', '0.0"%"'])
  })
})

describe('clientSummaryExportName', () => {
  it('names the period and the day the data was pulled', () => {
    expect(clientSummaryExportName('2026-01', '2026-12', new Date(2026, 8, 29))).toBe(
      'Revenue by Client 2026-01 to 2026-12 as of 2026-09-29',
    )
  })

  it('uses the local date, so a late-evening export is not stamped tomorrow', () => {
    expect(clientSummaryExportName('2026-07', '2026-09', new Date(2026, 8, 29, 23, 30))).toContain('as of 2026-09-29')
  })
})
