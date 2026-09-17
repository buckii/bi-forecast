import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { success, error, cors, corsHeaders } from '../response.js'

describe('Response Utils', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('success', () => {
    it('should return success response with default status code', () => {
      const data = { message: 'test data' }
      const result = success(data)

      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          data
        })
      })
    })

    it('should return success response with custom status code', () => {
      const data = { message: 'created' }
      const result = success(data, 201)

      expect(result.statusCode).toBe(201)
      expect(JSON.parse(result.body)).toEqual({
        success: true,
        data
      })
    })

    it('should handle null data', () => {
      const result = success(null)

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body)).toEqual({
        success: true,
        data: null
      })
    })

    it('should handle complex data structures', () => {
      const data = {
        users: [{ id: 1, name: 'John' }],
        pagination: { page: 1, total: 10 },
        metadata: { timestamp: '2024-01-01' }
      }
      const result = success(data)

      expect(JSON.parse(result.body).data).toEqual(data)
    })
  })

  describe('error', () => {
    it('should return error response with default status code', () => {
      const message = 'Something went wrong'
      const result = error(message)

      expect(result).toEqual({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          error: message
        })
      })
    })

    it('should return error response with custom status code', () => {
      const message = 'Not found'
      const result = error(message, 404)

      expect(result.statusCode).toBe(404)
      expect(JSON.parse(result.body)).toEqual({
        success: false,
        error: message
      })
    })

    it('should include details when provided', () => {
      const message = 'Validation failed'
      const details = { field: 'email', reason: 'invalid format' }
      const result = error(message, 422, details)

      expect(result.statusCode).toBe(422)
      expect(JSON.parse(result.body)).toEqual({
        success: false,
        error: message,
        details
      })
    })

    it('should log error to console', () => {
      const message = 'Test error'
      const details = { code: 'TEST_ERROR' }
      
      error(message, 500, details)

      expect(consoleSpy).toHaveBeenCalledWith('API Error:', message, details)
    })

    it('should handle complex error details', () => {
      const message = 'Database error'
      const details = {
        query: 'SELECT * FROM users',
        error: 'Connection timeout',
        stack: 'Error stack trace...'
      }
      const result = error(message, 500, details)

      expect(JSON.parse(result.body).details).toEqual(details)
    })
  })

  describe('cors', () => {
    it('should return CORS preflight response', () => {
      const result = cors()

      expect(result).toEqual({
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: ''
      })
    })

    it('should have consistent CORS headers with other functions', () => {
      const corsResult = cors()
      const successResult = success({})
      const errorResult = error('test')

      // Check that CORS headers are consistent
      const corsHeaders = corsResult.headers
      const successHeaders = successResult.headers
      const errorHeaders = errorResult.headers

      expect(corsHeaders['Access-Control-Allow-Origin']).toBe(successHeaders['Access-Control-Allow-Origin'])
      expect(corsHeaders['Access-Control-Allow-Headers']).toBe(successHeaders['Access-Control-Allow-Headers'])
      expect(corsHeaders['Access-Control-Allow-Methods']).toBe(successHeaders['Access-Control-Allow-Methods'])
      
      expect(corsHeaders['Access-Control-Allow-Origin']).toBe(errorHeaders['Access-Control-Allow-Origin'])
      expect(corsHeaders['Access-Control-Allow-Headers']).toBe(errorHeaders['Access-Control-Allow-Headers'])
      expect(corsHeaders['Access-Control-Allow-Methods']).toBe(errorHeaders['Access-Control-Allow-Methods'])
    })
  })

  describe('edge cases', () => {
    it('should handle very large data objects', () => {
      const largeData = {
        items: new Array(1000).fill(0).map((_, i) => ({ id: i, data: `item-${i}` }))
      }
      const result = success(largeData)

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.body).data.items).toHaveLength(1000)
    })

    it('should handle special characters in error messages', () => {
      const message = 'Error with special chars: üñíçødé & symbols!'
      const result = error(message)

      expect(JSON.parse(result.body).error).toBe(message)
    })

    it('should handle empty string error message', () => {
      const result = error('')

      expect(JSON.parse(result.body).error).toBe('')
    })

    it('should handle undefined data in success', () => {
      const result = success(undefined)

      expect(JSON.parse(result.body).data).toBeUndefined()
    })
  })
})
describe('error detail redaction', () => {
  const originalContext = process.env.CONTEXT
  const originalNodeEnv = process.env.NODE_ENV
  const originalExpose = process.env.EXPOSE_ERROR_DETAILS

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.CONTEXT = originalContext
    process.env.NODE_ENV = originalNodeEnv
    process.env.EXPOSE_ERROR_DETAILS = originalExpose
    if (originalContext === undefined) delete process.env.CONTEXT
    if (originalExpose === undefined) delete process.env.EXPOSE_ERROR_DETAILS
    vi.restoreAllMocks()
  })

  it('omits details in production so stack traces are not leaked', () => {
    process.env.CONTEXT = 'production'
    delete process.env.EXPOSE_ERROR_DETAILS

    const result = error('Database error', 500, 'Error: connection string ...')

    expect(JSON.parse(result.body)).toEqual({ success: false, error: 'Database error' })
  })

  it('still logs details in production', () => {
    process.env.CONTEXT = 'production'
    const details = 'Error: connection string ...'

    error('Database error', 500, details)

    expect(console.error).toHaveBeenCalledWith('API Error:', 'Database error', details)
  })

  it('includes details in deploy previews and branch deploys', () => {
    process.env.CONTEXT = 'deploy-preview'

    const result = error('Database error', 500, 'stack')

    expect(JSON.parse(result.body).details).toBe('stack')
  })

  it('can be forced on in production with EXPOSE_ERROR_DETAILS', () => {
    process.env.CONTEXT = 'production'
    process.env.EXPOSE_ERROR_DETAILS = 'true'

    const result = error('Database error', 500, 'stack')

    expect(JSON.parse(result.body).details).toBe('stack')
  })
})

describe('CORS origin', () => {
  const originalAllowed = process.env.ALLOWED_ORIGINS
  const originalUrl = process.env.URL

  afterEach(() => {
    if (originalAllowed === undefined) delete process.env.ALLOWED_ORIGINS
    else process.env.ALLOWED_ORIGINS = originalAllowed
    if (originalUrl === undefined) delete process.env.URL
    else process.env.URL = originalUrl
  })

  it('falls back to a wildcard when no origin is configured', () => {
    delete process.env.ALLOWED_ORIGINS
    delete process.env.URL

    expect(corsHeaders()['Access-Control-Allow-Origin']).toBe('*')
  })

  it('echoes an allowlisted origin', () => {
    process.env.ALLOWED_ORIGINS = 'https://forecast.example.com,https://staging.example.com'

    const headers = corsHeaders('https://staging.example.com')

    expect(headers['Access-Control-Allow-Origin']).toBe('https://staging.example.com')
    expect(headers['Vary']).toBe('Origin')
  })

  it('refuses an origin that is not allowlisted', () => {
    process.env.ALLOWED_ORIGINS = 'https://forecast.example.com'

    const headers = corsHeaders('https://evil.example.com')

    expect(headers['Access-Control-Allow-Origin']).toBe('https://forecast.example.com')
  })
})
