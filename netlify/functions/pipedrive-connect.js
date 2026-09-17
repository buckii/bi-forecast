const { createHandler, HttpError } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')
const { encrypt } = require('./utils/encryption.js')

async function isValidApiKey(apiKey) {
  try {
    const response = await fetch(`https://api.pipedrive.com/v1/users/me?api_token=${apiKey}`)
    if (!response.ok) return false
    const data = await response.json()
    return !!data.success
  } catch {
    return false
  }
}

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to connect Pipedrive' },
  async ({ company, body }) => {
    const { apiKey } = body
    if (!apiKey) throw new HttpError('API key is required', 400)

    if (!(await isValidApiKey(apiKey))) {
      throw new HttpError('Invalid Pipedrive API key. Please check your key and try again.', 400)
    }

    const tokensCollection = await getCollection('oauth_tokens')

    await tokensCollection.updateOne(
      { companyId: company._id, service: 'pipedrive' },
      {
        $set: { accessToken: encrypt(apiKey), updatedAt: new Date() },
        $setOnInsert: { companyId: company._id, service: 'pipedrive', createdAt: new Date() },
      },
      { upsert: true },
    )

    return { message: 'Pipedrive API key saved successfully', connected: true }
  },
)
