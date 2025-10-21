import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function useToast() {
  const show = (message, type = 'success', duration = 3000) => {
    const id = nextId++
    const toast = {
      id,
      message,
      type, // success, error, info, warning
      show: true
    }

    toasts.value.push(toast)

    if (duration > 0) {
      setTimeout(() => {
        remove(id)
      }, duration)
    }

    return id
  }

  const remove = (id) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  const success = (message, duration) => show(message, 'success', duration)
  const error = (message, duration) => show(message, 'error', duration)
  const info = (message, duration) => show(message, 'info', duration)
  const warning = (message, duration) => show(message, 'warning', duration)

  return {
    toasts,
    show,
    remove,
    success,
    error,
    info,
    warning
  }
}
