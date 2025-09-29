const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest')
const { success, error, cors } = require('../response')

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
          error: message,
          details: null
        })
      })
    })

    it('should return error response with custom status code', () => {
      const message = 'Not found'
      const result = error(message, 404)

      expect(result.statusCode).toBe(404)
      expect(JSON.parse(result.body)).toEqual({
        success: false,
        error: message,
        details: null
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