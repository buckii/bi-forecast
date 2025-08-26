import api from './api'

export default {
  async googleLogin(googleToken) {
    return api.post('/auth-google', { token: googleToken })
  },
  
  async getCurrentUser() {
    return api.get('/auth-current')
  },
  
  async logout() {
    return api.post('/auth-logout')
  }
}