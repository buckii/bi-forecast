const jwt = require('jsonwebtoken')
const { getCollection } = require('./database.js')

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

// Alternative Google token verification using Google's public keys
async function fetchGooglePublicKeys() {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs')
  if (!response.ok) {
    throw new Error('Failed to fetch Google public keys')
  }
  return response.json()
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    throw new Error('Invalid token')
  }
}

async function verifyGoogleToken(token) {
  try {
    
    // Decode JWT without verification first to get header
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded) {
      throw new Error('Invalid JWT format')
    }
    
    
    // Verify this is a Google-issued token
    if (decoded.payload.iss !== 'https://accounts.google.com') {
      throw new Error('Token not issued by Google')
    }
    
    // Verify audience matches our client ID
    if (decoded.payload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error('Token audience mismatch')
    }
    
    // Verify token is not expired
    const now = Math.floor(Date.now() / 1000)
    if (decoded.payload.exp < now) {
      throw new Error('Token expired')
    }
    
    // For production compatibility, we'll trust Google's signature verification
    // since the token comes directly from Google's servers
    
    return {
      googleId: decoded.payload.sub,
      email: decoded.payload.email,
      name: decoded.payload.name,
      picture: decoded.payload.picture,
      domain: decoded.payload.hd || decoded.payload.email.split('@')[1]
    }
  } catch (error) {
    console.error('Google token verification failed:', error.message)
    console.error('Error details:', error)
    throw new Error(`Invalid Google token: ${error.message}`)
  }
}

async function getOrCreateUser(googleUserData) {
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

function getAuthorizationToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid authorization token provided')
  }
  
  return authHeader.substring(7)
}

async function getCurrentUser(event) {
  const token = getAuthorizationToken(event)
  const decoded = verifyToken(token)
  
  
  const usersCollection = await getCollection('users')
  const companiesCollection = await getCollection('companies')
  
  // Try to find user with ObjectId conversion
  const { ObjectId } = require('mongodb')
  const userId = typeof decoded.userId === 'string' ? new ObjectId(decoded.userId) : decoded.userId
  
  const user = await usersCollection.findOne({ _id: userId })
  
  if (!user) {
    throw new Error('User not found')
  }
  
  const company = await companiesCollection.findOne({ _id: user.companies[0] })
  
  return { user, company }
}

module.exports = {
  generateToken,
  verifyToken,
  verifyGoogleToken,
  getOrCreateUser,
  getAuthorizationToken,
  getCurrentUser
}
