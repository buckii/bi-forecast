import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createHandler, HttpError } from '../handler.js'

const getCurrentUser = vi.fn()

function handlerFor(options, fn) {
  return createHandler({ authenticate: getCurrentUser, ...options }, fn)
}

const USER = { _id: 'u1', email: 'someone@example.com', role: 'viewer' }
const ADMIN = { ...USER, role: 'admin' }
const COMPANY = { _id: 'c1', name: 'Acme' }

function request(overrides = {}) {
  return { httpMethod: 'GET', headers: {}, ...overrides }
}

function bodyOf(response) {
  return JSON.parse(response.body)
}

describe('createHandler', () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({ user: USER, company: COMPANY })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    getCurrentUser.mockReset()
  })

  it('answers a CORS preflight without running the handler', async () => {
    const fn = vi.fn()
    const response = await handlerFor({}, fn)(request({ httpMethod: 'OPTIONS' }))

    expect(response.statusCode).toBe(200)
    expect(fn).not.toHaveBeenCalled()
  })

  it('rejects a method the endpoint does not declare', async () => {
    const response = await handlerFor({ methods: 'POST' }, async () => ({}))(request())

    expect(response.statusCode).toBe(405)
  })

  it('wraps the returned value in the success envelope', async () => {
    const response = await handlerFor({}, async () => ({ total: 42 }))(request())

    expect(response.statusCode).toBe(200)
    expect(bodyOf(response)).toEqual({ success: true, data: { total: 42 } })
  })

  it('passes the authenticated user and company to the handler', async () => {
    const handler = handlerFor({}, async ({ user, company }) => ({
      email: user.email,
      company: company.name,
    }))

    expect(bodyOf(await handler(request())).data).toEqual({
      email: 'someone@example.com',
      company: 'Acme',
    })
  })

  it('parses a JSON body for write methods', async () => {
    const handler = handlerFor({ methods: 'POST' }, async ({ body }) => body)
    const response = await handler(request({ httpMethod: 'POST', body: '{"name":"x"}' }))

    expect(bodyOf(response).data).toEqual({ name: 'x' })
  })

  it('rejects a malformed JSON body', async () => {
    const handler = handlerFor({ methods: 'POST' }, async () => ({}))
    const response = await handler(request({ httpMethod: 'POST', body: 'not json' }))

    expect(response.statusCode).toBe(400)
    expect(bodyOf(response).error).toBe('Invalid JSON body')
  })

  it('skips authentication when the endpoint is public', async () => {
    const handler = handlerFor({ auth: false }, async ({ user }) => ({ user }))
    const response = await handler(request())

    expect(response.statusCode).toBe(200)
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  describe('authorization', () => {
    it('allows a user whose role matches', async () => {
      getCurrentUser.mockResolvedValue({ user: ADMIN, company: COMPANY })
      const handler = handlerFor({ role: 'admin' }, async () => ({ ok: true }))

      expect((await handler(request())).statusCode).toBe(200)
    })

    it('refuses a user whose role does not', async () => {
      const handler = handlerFor({ role: 'admin' }, async () => ({ ok: true }))
      const response = await handler(request())

      expect(response.statusCode).toBe(403)
      expect(bodyOf(response).error).toBe('Insufficient permissions')
    })
  })

  describe('error mapping', () => {
    it('maps an expired or missing token to 401 so the client re-authenticates', async () => {
      getCurrentUser.mockRejectedValue(new Error('Invalid token'))
      const response = await handlerFor({}, async () => ({}))(request())

      expect(response.statusCode).toBe(401)
    })

    it('honors an HttpError status', async () => {
      const handler = handlerFor({}, async () => {
        throw new HttpError('Journal entry not found', 404)
      })

      expect((await handler(request())).statusCode).toBe(404)
    })

    it('honors a status a service tagged onto its error', async () => {
      const handler = handlerFor({}, async () => {
        const err = new Error('QuickBooks not connected.')
        err.statusCode = 424
        throw err
      })

      // 424, not 401: a disconnected integration must not log the user out.
      expect((await handler(request())).statusCode).toBe(424)
    })

    it('treats an unexpected error as a 500', async () => {
      const handler = handlerFor({}, async () => {
        throw new Error('undefined is not a function')
      })

      expect((await handler(request())).statusCode).toBe(500)
    })
  })

  it('passes through a response the handler built itself', async () => {
    const redirect = { statusCode: 302, headers: { Location: '/done' }, body: '' }
    const handler = handlerFor({}, async () => redirect)

    expect(await handler(request())).toBe(redirect)
  })
})
