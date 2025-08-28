import axios from 'axios'

const isDevelopment = import.meta.env.DEV
const baseURL = '/.netlify/functions'

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  response => {
    // If the response has a data wrapper with success flag, unwrap it
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if (response.data.success && response.data.data !== undefined) {
        return response.data.data
      }
      // If success is false, throw the error
      if (!response.data.success) {
        throw new Error(response.data.error || 'Request failed')
      }
    }
    return response.data
  },
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api