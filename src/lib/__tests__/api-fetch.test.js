import { describe, it, expect, beforeEach, vi } from 'vitest'
import { requestJson } from '../api-fetch.js'

describe('requestJson', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('unwraps the data payload', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { total: 42 } }) })

    expect(await requestJson('revenue-current')).toEqual({ total: 42 })
  })

  it('returns the body when there is no data wrapper', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ token: 'abc' }) })

    expect(await requestJson('auth-dev-login')).toEqual({ token: 'abc' })
  })

  it('sends the bearer token when given one', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) })
    await requestJson('users-list', { token: 'test-token' })

    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
  })

  it('omits the auth header when there is no token', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) })
    await requestJson('auth-google')

    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('serializes a body and sets the content type', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) })
    await requestJson('company-update', { method: 'POST', body: { name: 'Acme' } })

    const [, options] = global.fetch.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBe('{"name":"Acme"}')
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('raises the error the server reported', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Email is required' }) })

    await expect(requestJson('users-add')).rejects.toThrow('Email is required')
  })

  it('falls back to a given message when the server sends none', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })

    await expect(requestJson('users-add', { fallbackError: 'Could not add user' })).rejects.toThrow(
      'Could not add user',
    )
  })

  it('still raises when the error body is not JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json')
      },
    })

    await expect(requestJson('revenue-current')).rejects.toThrow(/failed/i)
  })
})
