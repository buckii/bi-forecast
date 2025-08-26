import { MongoClient } from 'mongodb'

let cachedClient = null
let cachedDb = null

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined')
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })

  await client.connect()
  const db = client.db(process.env.MONGODB_DB_NAME || 'bi-forecast')

  cachedClient = client
  cachedDb = db

  return { client, db }
}

export async function closeConnection() {
  if (cachedClient) {
    await cachedClient.close()
    cachedClient = null
    cachedDb = null
  }
}

// Collection helpers
export async function getCollection(collectionName) {
  const { db } = await connectToDatabase()
  return db.collection(collectionName)
}

// Transaction helper for multi-document operations
export async function withTransaction(operations) {
  const { client } = await connectToDatabase()
  const session = client.startSession()
  
  try {
    const result = await session.withTransaction(async () => {
      return await operations(session)
    })
    return result
  } finally {
    await session.endSession()
  }
}