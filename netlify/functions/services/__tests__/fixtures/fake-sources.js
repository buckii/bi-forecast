// A small QuickBooks and Pipedrive world for checking that every revenue path adds up the same.
// The fake QuickBooks answers the real query strings and caps each page at 100 rows, as the real API
// does, so a caller that forgets to paginate loses data here too.

const QB_PAGE_LIMIT = 100
const FILLER_INVOICES_PER_MONTH = 30

export const PAST_MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09']

export const ALIASES = { acme: 'Acme', 'acme corp.': 'Acme', 'beta llc': 'Beta LLC' }

const revenueLine = (amount, itemName) => ({
  DetailType: 'SalesItemLineDetail',
  Amount: amount,
  SalesItemLineDetail: { ItemRef: { name: itemName }, AccountRef: { name: '4000 Services Revenue' } },
})

function invoice(id, date, customer, lines) {
  return {
    Id: String(id),
    DocNumber: String(1000 + id),
    TxnDate: date,
    CustomerRef: { name: customer },
    TotalAmt: lines.reduce((sum, line) => sum + line.Amount, 0),
    Balance: 0,
    Line: lines,
  }
}

function buildInvoices() {
  const invoices = []
  let id = 1

  for (const month of PAST_MONTHS) {
    // First and last day of the month, where a timezone slip would move a month's revenue.
    invoices.push(invoice(id++, `${month}-01`, 'ACME Corp.', [revenueLine(500, 'Monthly Support')]))
    invoices.push(invoice(id++, `${month}-28`, 'Beta LLC', [revenueLine(300, 'Monthly Hosting')]))

    for (let filler = 0; filler < FILLER_INVOICES_PER_MONTH; filler++) {
      const day = String((filler % 27) + 1).padStart(2, '0')
      invoices.push(invoice(id++, `${month}-${day}`, `Filler Client ${filler}`, [revenueLine(100, 'Project Work')]))
    }
  }

  return invoices
}

const journalLine = (amount, postingType, accountName, description) => ({
  Amount: amount,
  Description: description,
  JournalEntryLineDetail: { PostingType: postingType, AccountRef: { name: accountName } },
})

// Acme's September invoice is spread across Sep, Oct and Nov: defer two thirds, then recognize a third a month.
function buildJournalEntries() {
  const entry = (id, date, revenueAmount, revenuePosting, note) => ({
    Id: String(id),
    DocNumber: `JE-${id}`,
    TxnDate: date,
    PrivateNote: note,
    Line: [
      journalLine(revenueAmount, revenuePosting, '4000 Services Revenue', `Acme project ${note}`),
      journalLine(revenueAmount, revenuePosting === 'Credit' ? 'Debit' : 'Credit', 'Unearned Revenue', note),
    ],
  })

  // A correction on a monthly revenue account: a debit, so it nets against recurring revenue.
  const monthlyCorrection = {
    Id: '9',
    DocNumber: 'JE-9',
    TxnDate: '2026-09-15',
    PrivateNote: 'Beta hosting credit',
    Line: [
      journalLine(120, 'Debit', '4100 Monthly Hosting Revenue', 'Beta LLC hosting credit'),
      journalLine(120, 'Credit', 'Unearned Revenue', 'Beta LLC hosting credit'),
    ],
  }

  return [
    monthlyCorrection,
    entry(1, '2026-09-30', 333.33, 'Debit', 'deferral'),
    entry(2, '2026-10-01', 166.67, 'Credit', 'recognition 1 of 2'),
    entry(3, '2026-11-01', 166.66, 'Credit', 'recognition 2 of 2'),
  ]
}

const DELAYED_CHARGES = [
  { date: '2026-10-31', doc: 'DC-1', customer: 'Beta LLC', amount: '1,000.00' },
  { date: '2026-11-01', doc: 'DC-2', customer: 'ACME Corp.', amount: '2,000.00' },
  { date: '2026-12-15', doc: 'DC-3', customer: 'Beta LLC', amount: '1,500.50' },
]

export const OPEN_DEALS = [
  // Three months at a third each, so the monthly share does not divide evenly.
  {
    id: 1,
    title: 'Beta redesign',
    orgName: 'Beta LLC',
    expectedCloseDate: '2026-10-15',
    value: 10000,
    weightedValue: 1000,
    probability: 10,
    duration: 3,
  },
  // A second uneven deal in the same months: rounding each share and rounding the month's total now disagree.
  {
    id: 4,
    title: 'Gamma rebuild',
    orgName: 'Gamma Inc',
    expectedCloseDate: '2026-10-20',
    value: 20000,
    weightedValue: 1000,
    probability: 5,
    duration: 3,
  },
  {
    id: 2,
    title: 'Acme audit',
    orgName: 'ACME Corp.',
    expectedCloseDate: '2027-02-10',
    value: 4000,
    weightedValue: 2000,
    probability: 50,
    duration: 1,
  },
]

export const WON_UNSCHEDULED_DEALS = [
  {
    id: 3,
    title: 'Acme phase two',
    orgName: 'Acme',
    projectStartDate: '2026-11-01',
    wonTime: '2026-09-01',
    expectedCloseDate: '2026-09-01',
    value: 5000,
    duration: 3,
  },
]

function transactionListReport(startDate, endDate) {
  const inRange = DELAYED_CHARGES.filter((charge) => charge.date >= startDate && charge.date <= endDate)
  return {
    Rows: {
      Row: inRange.map((charge) => ({
        type: 'Data',
        ColData: [
          { value: charge.date },
          { value: 'Charge' },
          { value: charge.doc },
          { value: charge.customer },
          { value: 'Services' },
          { value: '' },
          { value: charge.amount },
        ],
      })),
    },
  }
}

function answerQuery(query, records) {
  const entity = /FROM (\w+)/i.exec(query)[1]
  const dates = /TxnDate >= '([\d-]+)' AND TxnDate <= '([\d-]+)'/i.exec(query)
  const startPosition = Number(/STARTPOSITION (\d+)/i.exec(query)?.[1] || 1)
  const maxResults = Math.min(QB_PAGE_LIMIT, Number(/MAXRESULTS (\d+)/i.exec(query)?.[1] || QB_PAGE_LIMIT))

  let rows = records[entity] || []
  if (dates) rows = rows.filter((row) => row.TxnDate >= dates[1] && row.TxnDate <= dates[2])
  if (dates) rows = [...rows].sort((first, second) => second.TxnDate.localeCompare(first.TxnDate))

  return { QueryResponse: { [entity]: rows.slice(startPosition - 1, startPosition - 1 + maxResults) } }
}

/** Point a RevenueCalculator at the fake sources. Nothing reaches a network or a database. */
export function useFakeSources(calculator) {
  const records = {
    Invoice: buildInvoices(),
    JournalEntry: buildJournalEntries(),
    Customer: ['Acme', 'ACME Corp.', 'Beta LLC'].map((name, index) => ({ Id: String(index), DisplayName: name })),
  }

  calculator.qbo.getAccessToken = async () => ({ accessToken: 'test', realmId: 'test' })
  calculator.qbo.makeRequest = async (endpoint) => {
    if (endpoint.startsWith('query?query=')) return answerQuery(decodeURIComponent(endpoint.slice(12)), records)
    if (endpoint.startsWith('reports/TransactionList')) {
      const params = new URLSearchParams(endpoint.split('?')[1])
      return transactionListReport(params.get('start_date'), params.get('end_date'))
    }
    return { Rows: { Row: [] } }
  }

  calculator.pipedrive.getOpenDeals = async () => OPEN_DEALS.map((deal) => ({ ...deal }))
  calculator.pipedrive.getWonUnscheduledDeals = async () => WON_UNSCHEDULED_DEALS.map((deal) => ({ ...deal }))
  calculator.clientAliasesMap = { ...ALIASES }

  return calculator
}
