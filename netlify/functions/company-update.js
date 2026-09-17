const { createHandler, HttpError } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')

// Each setting validates itself, so adding one is a single line here.
const SETTING_VALIDATORS = {
  targetNetMargin: value => {
    if (typeof value !== 'number' || value < 1 || value > 50) {
      throw new HttpError('Target net margin must be a number between 1 and 50', 400)
    }
  },
  monthlyExpensesOverride: value => {
    if (value !== null && (typeof value !== 'number' || value < 0)) {
      throw new HttpError('Monthly expenses override must be a positive number or null', 400)
    }
  },
  pricePerPoint: value => {
    if (typeof value !== 'number' || value <= 0) {
      throw new HttpError('Price per point must be a positive number', 400)
    }
  }
}

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to update company information' },
  async ({ company, body }) => {
    const updateData = { updatedAt: new Date() }

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        throw new HttpError('Company name is required', 400)
      }
      updateData.name = body.name.trim()
    }

    const settings = { ...(company.settings || {}) }
    let settingsChanged = false

    for (const [key, validate] of Object.entries(SETTING_VALIDATORS)) {
      if (body[key] === undefined) continue
      validate(body[key])
      settings[key] = body[key]
      settingsChanged = true
    }

    if (settingsChanged) updateData.settings = settings

    const companiesCollection = await getCollection('companies')
    await companiesCollection.updateOne({ _id: company._id }, { $set: updateData })

    return { message: 'Company information updated successfully' }
  }
)
