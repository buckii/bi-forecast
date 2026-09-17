import { computed, ref } from 'vue'
import { useAuthStore } from '../stores/auth'

/** The comma-separated alias field as the API wants it: trimmed, empties dropped. */
export function parseAliases(text) {
  return (text || '')
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean)
}

/** Clients ready to save: named ones only, aliases split out. */
export function toAliasPayload(clients) {
  return clients
    .filter((client) => client.primaryName.trim())
    .map((client) => ({ primaryName: client.primaryName.trim(), aliases: parseAliases(client.aliases) }))
}

function byName(first, second) {
  return first.primaryName.localeCompare(second.primaryName, undefined, { sensitivity: 'base' })
}

/**
 * The client alias list on the settings page.
 *
 * The endpoint replaces the whole list on every write, so every edit saves all of them.
 */
export function useClientAliases(toast) {
  const authStore = useAuthStore()

  const clientAliases = ref([])
  const editingClientId = ref(null)
  let nextClientId = 1

  const sortedClientAliases = computed(() => [...clientAliases.value].sort(byName))

  function toggleClientEdit(clientId) {
    editingClientId.value = editingClientId.value === clientId ? null : clientId
  }

  function addNewClient() {
    const newClient = { _id: nextClientId++, primaryName: '', aliases: '' }

    // Added at the top so it appears directly under the button that created it.
    clientAliases.value.unshift(newClient)
    editingClientId.value = newClient._id
  }

  async function saveAllClientAliases() {
    const response = await fetch('/.netlify/functions/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify({ clientAliases: toAliasPayload(clientAliases.value) }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || errorData.message || 'Failed to save client aliases')
    }

    await loadClientAliases()
  }

  async function deleteClient(clientId) {
    try {
      clientAliases.value = clientAliases.value.filter((client) => client._id !== clientId)
      editingClientId.value = null

      await saveAllClientAliases()
      toast.success('Client deleted successfully')
    } catch (error) {
      console.error('Error deleting client:', error)
      toast.error('Failed to delete client: ' + error.message)
    }
  }

  async function saveIndividualClient(clientId) {
    const client = clientAliases.value.find((candidate) => candidate._id === clientId)

    if (!client || !client.primaryName.trim()) {
      toast.warning('Please enter a primary client name')
      return
    }

    try {
      await saveAllClientAliases()
      editingClientId.value = null
      toast.success('Client saved successfully')
    } catch (error) {
      console.error('Error saving client:', error)
      toast.error('Failed to save client: ' + error.message)
    }
  }

  async function loadClientAliases() {
    try {
      const response = await fetch('/.netlify/functions/client-aliases', {
        headers: { Authorization: `Bearer ${authStore.token}` },
      })
      if (!response.ok) return

      const { data } = await response.json()
      clientAliases.value = data.clientAliases
        .map((client) => ({
          _id: nextClientId++,
          primaryName: client.primaryName,
          aliases: client.aliases.join(', '),
        }))
        .sort(byName)
    } catch (error) {
      console.error('Error loading client aliases:', error)
    }
  }

  return {
    clientAliases,
    sortedClientAliases,
    editingClientId,
    toggleClientEdit,
    addNewClient,
    deleteClient,
    saveIndividualClient,
    saveAllClientAliases,
    loadClientAliases,
  }
}
