const { createHandler, HttpError } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')

exports.handler = createHandler(
  { methods: 'POST', errorMessage: 'Failed to update settings' },
  async ({ company, body }) => {
    if (body.clientAliases === undefined) {
      throw new HttpError('No settings provided to update', 400)
    }

    const clientAliasesCollection = await getCollection('client_aliases')

    // The client sends the full alias list, so this is a replace.
    await clientAliasesCollection.deleteMany({ companyId: company._id })

    if (body.clientAliases.length > 0) {
      await clientAliasesCollection.insertMany(
        body.clientAliases.map((client) => ({
          companyId: company._id,
          primaryName: client.primaryName,
          aliases: client.aliases,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
    }

    return { message: 'Client aliases updated successfully' }
  },
)
