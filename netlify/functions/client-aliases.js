const { createHandler } = require('./utils/handler.js')
const { getCollection } = require('./utils/database.js')

exports.handler = createHandler({ errorMessage: 'Failed to fetch client aliases' }, async ({ company }) => {
  const clientAliasesCollection = await getCollection('client_aliases')

  const aliases = await clientAliasesCollection
    .find({ companyId: company._id })
    .sort({ primaryName: 1 })
    .toArray()

  return {
    clientAliases: aliases.map(alias => ({
      primaryName: alias.primaryName,
      aliases: alias.aliases
    }))
  }
})
