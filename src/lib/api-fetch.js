// A single shape for the hand-rolled fetch calls: attach the token, unwrap `data`, and turn a
// failure into an Error carrying the server's own message.
//
// Calls made through src/services/api.js (axios) additionally redirect to login on a 401; these
// do not, which is why they are used for requests that handle their own errors.

/**
 * @param {string} endpoint name under /.netlify/functions, with any query string
 * @returns {Promise<object>} the `data` payload
 */
export async function requestJson(endpoint, { token, method = 'GET', body, fallbackError } = {}) {
  const response = await fetch(`/.netlify/functions/${endpoint}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || payload.message || fallbackError || `Request to ${endpoint} failed`)
  }

  return payload.data ?? payload
}
