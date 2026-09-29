// The six revenue components, in the order they are presented. One list, because the filter
// pills, the chart, the badge labels, the badge colors and the CSV export all need the same set.

export const TRANSACTION_TYPES = [
  {
    value: 'invoice',
    component: 'invoiced',
    chartColor: '#3b82f6',
    filterLabel: 'Invoiced',
    label: 'Invoice',
    color: 'bg-blue-100 text-blue-800',
  },
  {
    value: 'journalEntry',
    component: 'journalEntries',
    chartColor: '#10b981',
    filterLabel: 'Journal Entries',
    label: 'Journal Entry',
    color: 'bg-green-100 text-green-800',
  },
  {
    value: 'delayedCharge',
    component: 'delayedCharges',
    chartColor: '#f59e0b',
    filterLabel: 'Delayed Charges',
    label: 'Delayed Charge',
    color: 'bg-yellow-100 text-yellow-800',
  },
  {
    value: 'monthlyRecurring',
    component: 'monthlyRecurring',
    chartColor: '#8b5cf6',
    filterLabel: 'Monthly Recurring',
    label: 'Monthly Recurring',
    color: 'bg-purple-100 text-purple-800',
  },
  {
    value: 'wonUnscheduled',
    component: 'wonUnscheduled',
    chartColor: '#ec4899',
    filterLabel: 'Won Unscheduled',
    label: 'Won Unscheduled',
    color: 'bg-pink-100 text-pink-800',
  },
  {
    value: 'weightedSales',
    component: 'weightedSales',
    chartColor: '#64748b',
    filterLabel: 'Weighted Sales',
    label: 'Weighted Sales',
    color: 'bg-gray-100 text-gray-800',
  },
]

const DEFAULT_COLOR = 'bg-gray-100 text-gray-800'

const byValue = new Map(TRANSACTION_TYPES.map((type) => [type.value, type]))

/** The singular badge label, or the raw value for a type we do not know. */
export function transactionTypeLabel(value) {
  return byValue.get(value)?.label || value
}

export function transactionTypeColor(value) {
  return byValue.get(value)?.color || DEFAULT_COLOR
}

/**
 * Filter state with every type on, except weighted sales, which follows the dashboard toggle.
 */
export function defaultTypeFilters(includeWeightedSales) {
  return Object.fromEntries(
    TRANSACTION_TYPES.map((type) => [type.value, type.value === 'weightedSales' ? includeWeightedSales : true]),
  )
}
