<template>
  <div class="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
      View as of:
    </label>
    <div class="flex items-center space-x-2">
      <input
        type="date"
        :value="modelValue"
        @input="handleDateChange"
        :max="maxDate"
        class="input text-sm"
      />
      <button
        v-if="modelValue"
        @click="clearDate"
        class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
      >
        Clear
      </button>
    </div>
    <span
      v-if="modelValue"
      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
    >
      Historical Data
    </span>
  </div>
</template>

<script>
import { computed } from 'vue'
import { format } from 'date-fns'

export default {
  name: 'AsOfDateSelector',
  props: {
    modelValue: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    // Set max date to today
    const maxDate = computed(() => format(new Date(), 'yyyy-MM-dd'))

    const handleDateChange = (event) => {
      emit('update:modelValue', event.target.value)
    }

    const clearDate = () => {
      emit('update:modelValue', '')
    }

    return {
      maxDate,
      handleDateChange,
      clearDate
    }
  }
}
</script>

<style scoped>
/* Additional styling if needed */
</style>
