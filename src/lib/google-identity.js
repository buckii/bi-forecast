let pending = null

/** Google Identity Services, loaded once and shared by sign-in and the Sheets export. */
export function loadGoogleIdentity() {
  pending ||= new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) {
      resolve(window.google)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true

    script.onload = () => {
      if (window.google && window.google.accounts) {
        resolve(window.google)
      } else {
        reject(new Error('Google Identity Services failed to load'))
      }
    }

    script.onerror = () => {
      pending = null
      script.remove()
      reject(new Error('Failed to load Google Identity Services script'))
    }

    document.head.appendChild(script)
  })

  return pending
}
