const CryptoJS = require('crypto-js')

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-super-secret-encryption-key'

function encrypt(text) {
  if (!text) return null
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
}

function decrypt(encryptedText) {
  if (!encryptedText) return null
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

module.exports = { encrypt, decrypt }