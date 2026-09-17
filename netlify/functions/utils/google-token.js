// Verifies a Google ID token. The signature check is the whole point: without it the issuer,
// audience and expiry claims are just strings the caller chose, and anyone can log in as anyone.

const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const KEY_CACHE_TTL_MS = 60 * 60 * 1000

let cachedKeys = null
let cachedAt = 0

async function fetchGoogleKeys() {
  const response = await fetch(GOOGLE_CERTS_URL)
  if (!response.ok) throw new Error('Could not fetch Google signing keys')

  const { keys } = await response.json()
  if (!Array.isArray(keys) || keys.length === 0) throw new Error('Google returned no signing keys')

  return keys
}

async function loadKeys(loadFromGoogle, forceRefresh) {
  const isStale = Date.now() - cachedAt > KEY_CACHE_TTL_MS

  if (forceRefresh || !cachedKeys || isStale) {
    cachedKeys = await loadFromGoogle()
    cachedAt = Date.now()
  }

  return cachedKeys
}

function publicKeyFrom(jwk) {
  return crypto.createPublicKey({ key: jwk, format: 'jwk' })
}

/**
 * @param {string} token
 * @param {{ clientId?: string, loadFromGoogle?: () => Promise<object[]> }} [options]
 * @returns {Promise<{ googleId: string, email: string, name: string, picture: string, domain: string }>}
 */
async function verifyGoogleToken(token, options = {}) {
  const { clientId = process.env.GOOGLE_CLIENT_ID, loadFromGoogle = fetchGoogleKeys } = options

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured')

  try {
    const header = jwt.decode(token, { complete: true })?.header
    if (!header?.kid) throw new Error('Token is missing a key id')

    let keys = await loadKeys(loadFromGoogle, false)
    let jwk = keys.find(key => key.kid === header.kid)

    // Google rotates signing keys, so an unknown kid means the cache is behind.
    if (!jwk) {
      keys = await loadKeys(loadFromGoogle, true)
      jwk = keys.find(key => key.kid === header.kid)
    }

    if (!jwk) throw new Error('Token was not signed by a known Google key')

    const payload = jwt.verify(token, publicKeyFrom(jwk), {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: GOOGLE_ISSUERS
    })

    if (!payload.email) throw new Error('Token carries no email')

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      domain: payload.hd || payload.email.split('@')[1]
    }
  } catch (err) {
    console.error('Google token verification failed:', err.message)
    throw new Error(`Invalid Google token: ${err.message}`)
  }
}

module.exports = { verifyGoogleToken, GOOGLE_ISSUERS }
