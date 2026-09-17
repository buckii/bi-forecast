const crypto = require('crypto')
const { createHandler, HttpError } = require('./utils/handler.js')

const SCOPE = 'com.intuit.quickbooks.accounting'

exports.handler = createHandler({ errorMessage: 'Failed to start QuickBooks OAuth flow' }, async () => {
  const clientId = process.env.QBO_CLIENT_ID
  if (!clientId) throw new HttpError('QuickBooks OAuth not configured', 500)

  const redirectUri = process.env.QBO_REDIRECT_URI || `${process.env.URL}/.netlify/functions/qbo-oauth-callback`

  // NOTE: this state is returned to the client but is not verified on callback,
  // so it is not yet real CSRF protection -- see qbo-oauth-callback.js.
  const state = crypto.randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_id: clientId,
    scope: SCOPE,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  })

  return { authUrl: `https://appcenter.intuit.com/connect/oauth2?${params}`, state }
})
