<template>
  <canvas ref="chartCanvas"></canvas>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import { format, parse } from 'date-fns'

Chart.register(...registerables)

const props = defineProps({
  data: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['bar-click'])

const chartCanvas = ref(null)
let chartInstance = null

const chartColors = {
  invoiced: '#3b82f6',      // blue
  journalEntries: '#10b981', // emerald
  delayedCharges: '#f59e0b', // amber
  monthlyRecurring: '#8b5cf6', // violet
  wonUnscheduled: '#ec4899',  // pink
  weightedSales: '#64748b'    // slate
}

// Custom plugin to display total values above bar stacks
const totalLabelPlugin = {
  id: 'totalLabel',
  afterDatasetsDraw: function(chart) {
    const ctx = chart.ctx
    
    chart.data.labels.forEach((label, index) => {
      const meta = chart.getDatasetMeta(0)
      const dataPoint = meta.data[index]
      
      // Calculate total for this bar stack
      let total = 0
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const value = dataset.data[index] || 0
        total += value
      })
      
      if (total > 0) {
        // Get the top of the stack
        let stackTop = 0
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          const value = dataset.data[index] || 0
          stackTop += value
        })
        
        // Position the text
        const x = dataPoint.x
        const y = chart.scales.y.getPixelForValue(stackTop) - 10
        
        // Format the total value
        const formattedTotal = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(total)
        
        // Draw the total
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.font = '12px sans-serif'
        ctx.fillStyle = '#374151'
        ctx.fillText(formattedTotal, x, y)
        ctx.restore()
      }
    })
  }
}

function createChart() {
  if (chartInstance) {
    chartInstance.destroy()
  }
  
  const ctx = chartCanvas.value.getContext('2d')
  
  const labels = props.data.map(d => {
    const date = parse(d.month, 'yyyy-MM-dd', new Date())
    return format(date, 'MMM yyyy')
  })
  
  chartInstance = new Chart(ctx, {
    type: 'bar',
    plugins: [totalLabelPlugin],
    data: {
      labels,
      datasets: [
        {
          label: 'Invoiced',
          data: props.data.map(d => d.invoiced || 0),
          backgroundColor: chartColors.invoiced
        },
        {
          label: 'Journal Entries',
          data: props.data.map(d => d.journalEntries || 0),
          backgroundColor: chartColors.journalEntries
        },
        {
          label: 'Delayed Charges',
          data: props.data.map(d => d.delayedCharges || 0),
          backgroundColor: chartColors.delayedCharges
        },
        {
          label: 'Monthly Recurring',
          data: props.data.map(d => d.monthlyRecurring || 0),
          backgroundColor: chartColors.monthlyRecurring
        },
        {
          label: 'Won Unscheduled',
          data: props.data.map(d => d.wonUnscheduled || 0),
          backgroundColor: chartColors.wonUnscheduled
        },
        {
          label: 'Weighted Sales',
          data: props.data.map(d => d.weightedSales || 0),
          backgroundColor: chartColors.weightedSales
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: {
            display: false
          }
        },
        y: {
          stacked: true,
          ticks: {
            callback: function(value) {
              return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(value)
            }
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 10,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || ''
              const value = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(context.parsed.y)
              return `${label}: ${value}`
            },
            footer: function(tooltipItems) {
              const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0)
              return 'Total: ' + new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(total)
            }
          }
        }
      },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const element = elements[0]
          const monthIndex = element.index
          const datasetIndex = element.datasetIndex
          const month = props.data[monthIndex].month
          const component = Object.keys(chartColors)[datasetIndex]
          
          emit('bar-click', {
            month,
            component,
            value: props.data[monthIndex][component]
          })
        }
      }
    }
  })
}

onMounted(() => {
  if (props.data.length > 0) {
    createChart()
  }
})

watch(() => props.data, () => {
  if (props.data.length > 0) {
    createChart()
  }
}, { deep: true })
</script>