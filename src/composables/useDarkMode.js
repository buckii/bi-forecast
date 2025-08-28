import { ref, watch, onMounted, computed } from 'vue'

const isDarkMode = ref(true)

// Global reactive dark mode state that any component can use
export const isDarkModeGlobal = computed(() => isDarkMode.value)

export function useDarkMode() {
  const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value
  }

  const setDarkMode = (value) => {
    isDarkMode.value = value
  }

  // Watch for changes and update the DOM
  watch(isDarkMode, (newValue) => {
    if (newValue) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }, { immediate: true })

  // Initialize from localStorage on mount
  onMounted(() => {
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode !== null) {
      isDarkMode.value = savedMode === 'true'
    } else {
      // Default to dark mode
      isDarkMode.value = true
    }
  })

  return {
    isDarkMode,
    toggleDarkMode,
    setDarkMode,
    isDarkModeGlobal
  }
}