// Environment variable validation utility
// Validates required environment variables for production deployment

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'MONGODB_DB_NAME', 
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'GOOGLE_CLIENT_ID',
  'QBO_CLIENT_ID',
  'QBO_CLIENT_SECRET',
  'URL'
]

export function validateEnvironment() {
  const missing = []
  const weak = []

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar]
    
    if (!value) {
      missing.push(envVar)
      continue
    }

    // Check for weak/default values
    if (envVar === 'JWT_SECRET' && (value.includes('your-') || value.length < 32)) {
      weak.push(`${envVar}: appears to be default or too short (minimum 32 chars)`)
    }
    
    if (envVar === 'ENCRYPTION_KEY' && (value.includes('your-') || value.length < 32)) {
      weak.push(`${envVar}: appears to be default or too short (minimum 32 chars)`)
    }

    if (envVar === 'URL' && value.includes('localhost')) {
      weak.push(`${envVar}: still pointing to localhost`)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  if (weak.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Weak environment variable configuration: ${weak.join(', ')}`)
  }

  return true
}

// Validate specific function requirements
export function validateFunctionEnv(requiredVars = []) {
  const missing = requiredVars.filter(envVar => !process.env[envVar])
  
  if (missing.length > 0) {
    throw new Error(`Function missing required environment variables: ${missing.join(', ')}`)
  }
  
  return true
}