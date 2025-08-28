import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { getCollection } from './database.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    throw new Error('Invalid token')
  }
}

export async function verifyGoogleToken(token) {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    })
    
    const payload = ticket.getPayload()
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      domain: payload.hd || payload.email.split('@')[1]
    }
  } catch (error) {
    throw new Error('Invalid Google token')
  }
}

export async function getOrCreateUser(googleUserData) {
  const usersCollection = await getCollection('users')
  const companiesCollection = await getCollection('companies')
  
  // Check if user exists
  let user = await usersCollection.findOne({ 
    $or: [
      { googleId: googleUserData.googleId },
      { email: googleUserData.email }
    ]
  })
  
  if (user) {
    // Update user info if changed
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          name: googleUserData.name,
          picture: googleUserData.picture,
          lastLogin: new Date()
        }
      }
    )
  } else {
    // Create new user
    const newUser = {
      email: googleUserData.email,
      name: googleUserData.name,
      picture: googleUserData.picture,
      googleId: googleUserData.googleId,
      companies: [],
      createdAt: new Date(),
      lastLogin: new Date()
    }
    
    const result = await usersCollection.insertOne(newUser)
    user = { ...newUser, _id: result.insertedId }
  }
  
  // Find or create company based on domain
  let company = await companiesCollection.findOne({ domain: googleUserData.domain })
  
  if (!company) {
    const newCompany = {
      name: googleUserData.domain.split('.')[0].charAt(0).toUpperCase() + 
            googleUserData.domain.split('.')[0].slice(1),
      domain: googleUserData.domain,
      settings: {
        defaultCurrency: 'USD',
        fiscalYearStart: new Date(new Date().getFullYear(), 0, 1),
        archiveRetentionDays: 365
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await companiesCollection.insertOne(newCompany)
    company = { ...newCompany, _id: result.insertedId }
  }
  
  // Add user to company if not already associated
  if (!user.companies.some(id => id.toString() === company._id.toString())) {
    await usersCollection.updateOne(
      { _id: user._id },
      { $push: { companies: company._id } }
    )
    user.companies.push(company._id)
  }
  
  return { user, company }
}

export function getAuthorizationToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid authorization token provided')
  }
  
  return authHeader.substring(7)
}

export async function getCurrentUser(event) {
  const token = getAuthorizationToken(event)
  const decoded = verifyToken(token)
  
  console.log('Decoded token:', decoded)
  
  const usersCollection = await getCollection('users')
  const companiesCollection = await getCollection('companies')
  
  // Try to find user with ObjectId conversion
  const { ObjectId } = await import('mongodb')
  const userId = typeof decoded.userId === 'string' ? new ObjectId(decoded.userId) : decoded.userId
  
  console.log('Looking for user with ID:', userId)
  const user = await usersCollection.findOne({ _id: userId })
  console.log('Found user:', user ? 'yes' : 'no')
  
  if (!user) {
    throw new Error('User not found')
  }
  
  const company = await companiesCollection.findOne({ _id: user.companies[0] })
  
  return { user, company }
}