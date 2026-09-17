const jwt = require('jsonwebtoken')
const { getCollection } = require('./database.js')
const { verifyGoogleToken } = require('./google-token.js')

// Read at call time, never defaulted: a fallback secret signs forgeable sessions.
function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  return secret
}

function generateToken(payload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: '7d' })
}

function verifyToken(token) {
  const secret = jwtSecret()

  try {
    return jwt.verify(token, secret)
  } catch (error) {
    throw new Error('Invalid token')
  }
}

async function getOrCreateUser(googleUserData) {
  const usersCollection = await getCollection('users')
  const companiesCollection = await getCollection('companies')

  // First, check if user exists in authorized users list
  let user = await usersCollection.findOne({
    email: googleUserData.email.toLowerCase(),
  })

  let company = null

  if (user) {
    // User found in authorized list
    // Update user info and last login
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          name: googleUserData.name,
          picture: googleUserData.picture,
          googleId: googleUserData.googleId,
          lastLoginAt: new Date(),
        },
      },
    )

    // Update user object with latest data
    user.name = googleUserData.name
    user.picture = googleUserData.picture
    user.googleId = googleUserData.googleId
    user.lastLoginAt = new Date()

    // Get the company - handle both old (companies array) and new (companyId) user structures
    const companyId = user.companyId || (user.companies && user.companies[0])
    if (!companyId) {
      throw new Error('User has no associated company')
    }
    company = await companiesCollection.findOne({ _id: companyId })
  } else {
    // User not in authorized list - check for domain-based access
    company = await companiesCollection.findOne({ domain: googleUserData.domain })

    if (!company) {
      // Neither user nor domain authorized - deny access
      throw new Error('Access denied. Please contact an administrator to request access.')
    }

    // Domain is authorized - create/update user automatically
    user = await usersCollection.findOne({
      $or: [{ googleId: googleUserData.googleId }, { email: googleUserData.email.toLowerCase() }],
    })

    if (user) {
      // Update existing user
      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            name: googleUserData.name,
            picture: googleUserData.picture,
            googleId: googleUserData.googleId,
            companyId: company._id,
            role: user.role || 'viewer', // Keep existing role or default to viewer
            lastLoginAt: new Date(),
          },
        },
      )
    } else {
      // Create new user with domain-based access
      const newUser = {
        email: googleUserData.email.toLowerCase(),
        name: googleUserData.name,
        picture: googleUserData.picture,
        googleId: googleUserData.googleId,
        companyId: company._id,
        role: 'admin', // First user in domain gets admin access
        createdAt: new Date(),
        lastLoginAt: new Date(),
      }

      const result = await usersCollection.insertOne(newUser)
      user = { ...newUser, _id: result.insertedId }
    }
  }

  if (!company) {
    throw new Error('Company not found')
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
  // Check if we should bypass auth for localhost development
  const bypassAuth = process.env.BYPASS_AUTH_LOCALHOST === 'true'
  const isLocalhost = event.headers.host?.includes('localhost') || event.headers.host?.includes('127.0.0.1')

  if (bypassAuth && isLocalhost) {
    // Return a default user/company for localhost development
    const usersCollection = await getCollection('users')
    const companiesCollection = await getCollection('companies')

    // Try to get the first user and company from the database
    const user = await usersCollection.findOne({})
    const company = await companiesCollection.findOne({})

    if (!user || !company) {
      throw new Error('No default user/company found in database for localhost bypass')
    }

    return { user, company }
  }

  // Normal authentication flow - this will throw if no token provided
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

  // Handle both old (companies array) and new (companyId) user structures
  const companyId = user.companyId || (user.companies && user.companies[0])
  if (!companyId) {
    throw new Error('User has no associated company')
  }

  const company = await companiesCollection.findOne({ _id: companyId })

  if (!company) {
    throw new Error('Company not found')
  }

  return { user, company }
}

module.exports = {
  generateToken,
  verifyToken,
  verifyGoogleToken,
  getOrCreateUser,
  getAuthorizationToken,
  getCurrentUser,
}
