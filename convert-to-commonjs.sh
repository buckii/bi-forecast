#!/bin/bash

# Convert all Netlify functions from ES modules to CommonJS

# Convert auth-current.js
sed -i '' "s/import { success, error, cors } from '.\/utils\/response.js'/const { success, error, cors } = require('.\/utils\/response.js')/g" netlify/functions/auth-current.js
sed -i '' "s/import { getCurrentUser } from '.\/utils\/auth.js'/const { getCurrentUser } = require('.\/utils\/auth.js')/g" netlify/functions/auth-current.js
sed -i '' "s/export async function handler/exports.handler = async function/g" netlify/functions/auth-current.js

# Convert auth-google.js
sed -i '' "s/import { success, error, cors } from '.\/utils\/response.js'/const { success, error, cors } = require('.\/utils\/response.js')/g" netlify/functions/auth-google.js
sed -i '' "s/import { verifyGoogleToken, getOrCreateUser, generateToken } from '.\/utils\/auth.js'/const { verifyGoogleToken, getOrCreateUser, generateToken } = require('.\/utils\/auth.js')/g" netlify/functions/auth-google.js
sed -i '' "s/import { validateFunctionEnv } from '.\/utils\/env-validation.js'/const { validateFunctionEnv } = require('.\/utils\/env-validation.js')/g" netlify/functions/auth-google.js
sed -i '' "s/export async function handler/exports.handler = async function/g" netlify/functions/auth-google.js

# Convert auth-logout.js
sed -i '' "s/import { success, cors } from '.\/utils\/response.js'/const { success, cors } = require('.\/utils\/response.js')/g" netlify/functions/auth-logout.js
sed -i '' "s/export async function handler/exports.handler = async function/g" netlify/functions/auth-logout.js

# Convert all other function files
for file in netlify/functions/*.js; do
  if [ -f "$file" ]; then
    # Convert imports
    sed -i '' "s/^import /const /g" "$file"
    sed -i '' "s/ from '/ = require('/g" "$file"
    sed -i '' "s/'$/');/g" "$file"
    sed -i '' "s/');$/');/g" "$file"
    
    # Convert exports
    sed -i '' "s/^export async function handler/exports.handler = async function/g" "$file"
    sed -i '' "s/^export function handler/exports.handler = function/g" "$file"
  fi
done

# Fix env-validation.js if it exists
if [ -f "netlify/functions/utils/env-validation.js" ]; then
  sed -i '' "s/^export function /function /g" netlify/functions/utils/env-validation.js
  echo "
module.exports = { validateFunctionEnv }" >> netlify/functions/utils/env-validation.js
fi

echo "Conversion complete!"