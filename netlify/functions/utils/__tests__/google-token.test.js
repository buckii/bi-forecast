import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { verifyGoogleToken } from '../google-token.js'

const CLIENT_ID = 'forecast.apps.googleusercontent.com'
const KEY_ID = 'google-key-1'

function keyPair(kid) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  return { privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } }
}

const google = keyPair(KEY_ID)
const attacker = keyPair(KEY_ID)

const CLAIMS = {
  sub: '1234567890',
  email: 'brad@buckeyeinnovation.com',
  name: 'Brad',
  hd: 'buckeyeinnovation.com'
}

function sign(privateKey, { claims = CLAIMS, kid = KEY_ID, ...overrides } = {}) {
  return jwt.sign(
    { iss: 'https://accounts.google.com', aud: CLIENT_ID, ...claims, ...overrides },
    privateKey,
    { algorithm: 'RS256', expiresIn: '1h', header: { kid }, ...(overrides.signOptions || {}) }
  )
}

function verify(token, loadFromGoogle = async () => [google.jwk]) {
  return verifyGoogleToken(token, { clientId: CLIENT_ID, loadFromGoogle })
}

describe('verifyGoogleToken', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('accepts a token Google actually signed', async () => {
    const user = await verify(sign(google.privateKey))

    expect(user).toEqual({
      googleId: '1234567890',
      email: 'brad@buckeyeinnovation.com',
      name: 'Brad',
      picture: undefined,
      domain: 'buckeyeinnovation.com'
    })
  })

  it('falls back to the email domain when the token carries no hosted domain', async () => {
    const token = sign(google.privateKey, { claims: { ...CLAIMS, hd: undefined } })

    expect((await verify(token)).domain).toBe('buckeyeinnovation.com')
  })

  describe('rejects', () => {
    it('a token signed by someone other than Google', async () => {
      // The whole attack: right claims, right kid, wrong key.
      await expect(verify(sign(attacker.privateKey))).rejects.toThrow(/Invalid Google token/)
    })

    it('an unsigned token', async () => {
      const unsigned = jwt.sign({ iss: 'https://accounts.google.com', aud: CLIENT_ID, ...CLAIMS }, '', {
        algorithm: 'none',
        header: { kid: KEY_ID }
      })

      await expect(verify(unsigned)).rejects.toThrow(/Invalid Google token/)
    })

    it('an expired token', async () => {
      const expired = jwt.sign(
        { iss: 'https://accounts.google.com', aud: CLIENT_ID, ...CLAIMS },
        google.privateKey,
        { algorithm: 'RS256', expiresIn: '-1h', header: { kid: KEY_ID } }
      )

      await expect(verify(expired)).rejects.toThrow(/expired/i)
    })

    it('a token minted for a different client', async () => {
      await expect(verify(sign(google.privateKey, { aud: 'someone-elses-app' }))).rejects.toThrow(
        /audience/i
      )
    })

    it('a token from a different issuer', async () => {
      await expect(verify(sign(google.privateKey, { iss: 'https://evil.example.com' }))).rejects.toThrow(
        /issuer/i
      )
    })

    it('a token signed with a key id Google does not publish', async () => {
      const token = sign(google.privateKey, { kid: 'unknown-key' })

      await expect(verify(token)).rejects.toThrow(/not signed by a known Google key/)
    })

    it('a token with no key id at all', async () => {
      const token = jwt.sign({ aud: CLIENT_ID, ...CLAIMS }, google.privateKey, { algorithm: 'RS256' })

      await expect(verify(token)).rejects.toThrow(/missing a key id/)
    })

    it('a malformed token', async () => {
      await expect(verify('not-a-jwt')).rejects.toThrow(/Invalid Google token/)
    })

    it('a token carrying no email', async () => {
      const token = sign(google.privateKey, { claims: { sub: '1', hd: 'example.com' } })

      await expect(verify(token)).rejects.toThrow(/no email/)
    })
  })

  it('accepts the bare issuer form Google also uses', async () => {
    const token = sign(google.privateKey, { iss: 'accounts.google.com' })

    expect((await verify(token)).email).toBe('brad@buckeyeinnovation.com')
  })

  it('refetches signing keys when it meets an unknown key id', async () => {
    // Fresh module, so the signing-key cache starts cold.
    vi.resetModules()
    const { verifyGoogleToken: freshVerify } = await import('../google-token.js')

    const rotated = keyPair('google-key-2')
    let call = 0
    const loadFromGoogle = vi.fn(async () => (++call === 1 ? [google.jwk] : [google.jwk, rotated.jwk]))

    const token = sign(rotated.privateKey, { kid: 'google-key-2' })

    expect((await freshVerify(token, { clientId: CLIENT_ID, loadFromGoogle })).email).toBe(
      'brad@buckeyeinnovation.com'
    )
    expect(loadFromGoogle).toHaveBeenCalledTimes(2)
  })

  it('refuses to run without a configured client id', async () => {
    await expect(
      verifyGoogleToken(sign(google.privateKey), { clientId: '', loadFromGoogle: async () => [google.jwk] })
    ).rejects.toThrow(/GOOGLE_CLIENT_ID/)
  })
})
