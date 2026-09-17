import { ref } from 'vue'
import { Chart, registerables } from 'chart.js'
import { formatCurrency, formatShare } from '../lib/format.js'
import { isDarkModeGlobal } from './useDarkMode'

// Enough hues that the top slices stay distinguishable; it wraps beyond that.
const SLICE_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#a855f7',
  '#14b8a6',
  '#6366f1',
  '#ef4444',
  '#22c55e',
  '#eab308',
  '#d946ef',
  '#0ea5e9',
  '#f43f5e',
]

const MAX_SLICES = 10

let registered = false

// Registered on first draw rather than on import, so importing this module has no side effect.
function registerChartOnce() {
  if (registered) return
  Chart.register(...registerables)
  registered = true
}

/** The top clients by value, with the remainder rolled into one slice. */
export function toPieSlices(clients) {
  const top = clients.slice(0, MAX_SLICES)
  const rest = clients.slice(MAX_SLICES)

  if (rest.length === 0) return top

  return [
    ...top,
    {
      client: `Other Clients (${rest.length})`,
      total: rest.reduce((sum, client) => sum + client.total, 0),
    },
  ]
}

/**
 * The client revenue pie. Callers own when it is drawn; this owns the one chart instance, so a
 * redraw never leaks the previous one.
 */
export function useClientPieChart({ canvas, clients, total }) {
  let chart = null
  const hasChart = ref(false)

  function destroy() {
    chart?.destroy()
    chart = null
    hasChart.value = false
  }

  /** The rendered pie as a PNG data URL, or null when there is no chart. */
  function toImage() {
    return chart ? chart.toBase64Image('image/png', 1.0) : null
  }

  function draw() {
    if (!canvas.value || clients.value.length === 0) return

    registerChartOnce()
    destroy()

    const slices = toPieSlices(clients.value)
    const grandTotal = total.value

    chart = new Chart(canvas.value.getContext('2d'), {
      type: 'pie',
      data: {
        labels: slices.map((slice) => slice.client),
        datasets: [
          {
            data: slices.map((slice) => slice.total),
            backgroundColor: slices.map((_, index) => SLICE_COLORS[index % SLICE_COLORS.length]),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: isDarkModeGlobal.value ? '#ffffff' : '#374151',
              padding: 10,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: {
              label: (context) =>
                `${context.label || ''}: ${formatCurrency(context.parsed)} (${formatShare(context.parsed, grandTotal)})`,
            },
          },
        },
      },
    })

    hasChart.value = true
  }

  return { draw, destroy, toImage, hasChart }
}
