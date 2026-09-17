// HTTP response helpers. Responses are locked to ALLOWED_ORIGINS (or the site's own URL) so other
// sites cannot call authenticated endpoints; with neither set it falls back to '*' for local dev.

function allowedOrigins() {
  const configured = process.env.ALLOWED_ORIGINS || process.env.URL || ''
  return configured
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

function corsHeaders(requestOrigin) {
  const allowed = allowedOrigins()
  let origin = '*'

  if (allowed.length > 0) {
    // An off-list caller gets the canonical origin, so the browser rejects it.
    origin = requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : allowed[0]
  }

  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }

  if (origin !== '*') headers['Vary'] = 'Origin'

  return headers
}

// Stack traces and driver messages are an information leak in production. They are always logged.
function exposeErrorDetails() {
  if (process.env.EXPOSE_ERROR_DETAILS === 'true') return true
  if (process.env.CONTEXT) return process.env.CONTEXT !== 'production'
  return process.env.NODE_ENV !== 'production'
}

function success(data, statusCode = 200, requestOrigin) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(requestOrigin) },
    body: JSON.stringify({ success: true, data }),
  }
}

function error(message, statusCode = 400, details = null, requestOrigin) {
  console.error('API Error:', message, details)

  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(requestOrigin) },
    body: JSON.stringify({
      success: false,
      error: message,
      ...(details && exposeErrorDetails() ? { details } : {}),
    }),
  }
}

function cors(requestOrigin) {
  return { statusCode: 200, headers: corsHeaders(requestOrigin), body: '' }
}

module.exports = { success, error, cors, corsHeaders, exposeErrorDetails }
