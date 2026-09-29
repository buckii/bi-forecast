<template>
  <div class="flex flex-wrap items-end gap-2">
    <div>
      <label for="month-range-start" class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
        >From</label
      >
      <select
        id="month-range-start"
        :class="SELECT_CLASSES"
        :value="start"
        :disabled="disabled"
        @change="setStart($event.target.value)"
      >
        <option v-for="option in options" :key="option" :value="option">{{ formatMonth(option) }}</option>
      </select>
    </div>
    <div>
      <label for="month-range-end" class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
      <select
        id="month-range-end"
        :class="SELECT_CLASSES"
        :value="end"
        :disabled="disabled"
        @change="setEnd($event.target.value)"
      >
        <option v-for="option in options" :key="option" :value="option">{{ formatMonth(option) }}</option>
      </select>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="btn-secondary px-2.5"
        aria-label="Previous period"
        :disabled="disabled"
        @click="shiftPeriod(-span)"
      >
        <ChevronLeftIcon class="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="btn-secondary px-2.5"
        aria-label="Next period"
        :disabled="disabled"
        @click="shiftPeriod(span)"
      >
        <ChevronRightIcon class="w-4 h-4" aria-hidden="true" />
      </button>
    </div>

    <div ref="quickRanges" class="relative" @keydown.esc="quickRangesOpen = false">
      <button
        type="button"
        class="btn-secondary flex items-center gap-2"
        :disabled="disabled"
        :aria-expanded="quickRangesOpen"
        @click="toggleQuickRanges"
      >
        <CalendarDaysIcon class="w-4 h-4" aria-hidden="true" />
        Quick ranges
        <ChevronDownIcon class="w-4 h-4 xl:hidden" aria-hidden="true" />
        <ChevronRightIcon class="w-4 h-4 hidden xl:block" aria-hidden="true" />
      </button>

      <div
        v-if="quickRangesOpen"
        class="absolute left-0 top-full mt-2 xl:left-full xl:top-0 xl:mt-0 xl:ml-2 z-30 w-[min(34rem,calc(100vw-2rem))] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-4 space-y-3"
      >
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
            Quick ranges
          </span>
          <button
            type="button"
            class="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Previous year"
            @click="quickYear--"
          >
            <ChevronLeftIcon class="w-4 h-4" aria-hidden="true" />
          </button>
          <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums w-12 text-center">
            {{ quickYear }}
          </span>
          <button
            type="button"
            class="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Next year"
            @click="quickYear++"
          >
            <ChevronRightIcon class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div v-for="(ranges, rowIndex) in [periodRanges, monthRanges]" :key="rowIndex" class="flex flex-wrap gap-1.5">
          <button
            v-for="range in ranges"
            :key="range.label"
            type="button"
            :class="['chip text-xs', isSelected(range) && 'chip-selected']"
            :aria-pressed="isSelected(range)"
            @click="chooseRange(range)"
          >
            {{ range.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { CalendarDaysIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'
import { onClickOutside } from '@vueuse/core'
import { computed, ref } from 'vue'
import { formatMonth } from '../lib/format.js'
import { monthSpan, monthsBetween, shiftMonth } from '../lib/month-keys.js'

// Two years keeps a load under a few minutes on a cold cache.
const MAX_MONTHS = 24
const YEARS_BACK = 3
const YEARS_FORWARD = 2
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SELECT_CLASSES =
  'block rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100 py-2 pl-3 pr-9 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50'

const props = defineProps({
  start: { type: String, required: true },
  end: { type: String, required: true },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:start', 'update:end'])

const thisYear = new Date().getFullYear()
const defaultFirst = `${thisYear - YEARS_BACK}-01`
const defaultLast = `${thisYear + YEARS_FORWARD}-12`
// Stretches to cover the selection, so stepping past the default years never shows a blank select.
const options = computed(() =>
  monthsBetween(
    props.start < defaultFirst ? props.start : defaultFirst,
    props.end > defaultLast ? props.end : defaultLast,
  ),
)
const span = computed(() => monthSpan(props.start, props.end))

const quickRanges = ref(null)
const quickRangesOpen = ref(false)
const quickYear = ref(thisYear)
onClickOutside(quickRanges, () => (quickRangesOpen.value = false))

const monthKey = (month) => `${quickYear.value}-${String(month).padStart(2, '0')}`

const periodRanges = computed(() => [
  { label: 'Full year', start: monthKey(1), end: monthKey(12) },
  ...[0, 1, 2, 3].map((quarter) => ({
    label: `Q${quarter + 1} · ${MONTH_NAMES[quarter * 3]}–${MONTH_NAMES[quarter * 3 + 2]}`,
    start: monthKey(quarter * 3 + 1),
    end: monthKey(quarter * 3 + 3),
  })),
])

const monthRanges = computed(() =>
  MONTH_NAMES.map((name, index) => ({
    label: `${name} ${String(quickYear.value).slice(2)}`,
    start: monthKey(index + 1),
    end: monthKey(index + 1),
  })),
)

function isSelected(range) {
  return props.start === range.start && props.end === range.end
}

/** Opens on the year the current period starts in. */
function toggleQuickRanges() {
  if (!quickRangesOpen.value) quickYear.value = Number(props.start.slice(0, 4))
  quickRangesOpen.value = !quickRangesOpen.value
}

function chooseRange(range) {
  update(range.start, range.end)
  quickRangesOpen.value = false
}

function update(start, end) {
  emit('update:start', start)
  emit('update:end', end)
}

/** A start past the end, or too far before it, pulls the end along. */
function setStart(start) {
  let end = props.end
  if (end < start) end = start
  if (monthSpan(start, end) > MAX_MONTHS) end = shiftMonth(start, MAX_MONTHS - 1)
  update(start, end)
}

function setEnd(end) {
  let start = props.start
  if (start > end) start = end
  if (monthSpan(start, end) > MAX_MONTHS) start = shiftMonth(end, -(MAX_MONTHS - 1))
  update(start, end)
}

function shiftPeriod(offset) {
  update(shiftMonth(props.start, offset), shiftMonth(props.end, offset))
}
</script>
