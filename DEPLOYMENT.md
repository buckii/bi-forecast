# Production Deployment Guide

## Prerequisites

Before deploying to production, ensure you have:

1. **Netlify Account** - Sign up at [netlify.com](https://netlify.com)
2. **MongoDB Atlas Account** - Sign up at [mongodb.com/atlas](https://mongodb.com/atlas)
3. **Google Cloud Console Project** - For OAuth authentication
4. **QuickBooks Developer Account** - For QuickBooks integration

## Environment Variables

Set the following environment variables in your Netlify deployment:

### Required Variables

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=bi-forecast

# Security (Generate strong random values)
JWT_SECRET=your-strong-random-jwt-secret
ENCRYPTION_KEY=your-strong-random-encryption-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# QuickBooks OAuth
QBO_CLIENT_ID=your-quickbooks-client-id
QBO_CLIENT_SECRET=your-quickbooks-client-secret
QBO_REDIRECT_URI=https://your-domain.com/.netlify/functions/qbo-oauth-callback

# Site Configuration
URL=https://your-domain.com
NODE_ENV=production

# Optional: Feature Flags (defaults work for most deployments)
# ENABLE_DEBUG_LOGGING=false
# DEFAULT_TARGET_NET_MARGIN=20
# DEFAULT_ARCHIVE_RETENTION_DAYS=365
```

### Generating Secure Keys

Use Node.js to generate secure random keys:

```javascript
// Run in Node.js console or script
const crypto = require('crypto');
console.log('JWT_SECRET:', crypto.randomBytes(32).toString('hex'));
console.log('ENCRYPTION_KEY:', crypto.randomBytes(32).toString('hex'));
```

## Security Configuration

### 1. MongoDB Atlas Setup

1. Create a MongoDB Atlas cluster
2. Set up database user with minimal required permissions
3. Configure network access:
   - Add `0.0.0.0/0` for development
   - For production, restrict to specific IPs if possible
4. Create database indexes for performance:
   ```javascript
   db.users.createIndex({ email: 1 }, { unique: true })
   db.companies.createIndex({ domain: 1 }, { unique: true })
   ```

### 2. Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Configure authorized domains:
   - Add your production domain
   - Set authorized redirect URIs
6. Download client configuration

### 3. QuickBooks OAuth Configuration

1. Go to [Intuit Developer](https://developer.intuit.com)
2. Create an app for QuickBooks Online API
3. Configure OAuth settings:
   - Redirect URI: `https://your-domain.com/.netlify/functions/qbo-oauth-callback`
   - Scopes: `com.intuit.quickbooks.accounting`
4. Note client ID and secret

## Deployment Steps

### 1. Build and Deploy

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy to Netlify (if using Netlify CLI)
netlify deploy --prod
```

### 2. Netlify Configuration

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Set functions directory: `netlify/functions`
5. Add all environment variables in Netlify dashboard

### 3. Domain Configuration

1. Configure custom domain in Netlify
2. Enable HTTPS (automatic with Netlify)
3. Update OAuth redirect URIs with production domain
4. Test all OAuth flows

## Security Checklist

### Application Security

- [x] Strong JWT secrets (32+ bytes random)
- [x] Encrypted OAuth tokens in database
- [x] Domain-restricted Google OAuth
- [x] HTTPS-only in production
- [x] Secure MongoDB connection
- [x] Input validation on all endpoints
- [x] Rate limiting implemented
- [x] Error messages don't leak sensitive info

### Database Security

- [x] MongoDB authentication enabled
- [x] Network access restricted
- [x] Database user has minimal permissions
- [x] Connection string uses TLS
- [x] Regular backups configured

### Infrastructure Security

- [x] HTTPS enforced
- [x] CORS properly configured
- [x] Security headers set
- [x] No sensitive data in client code
- [x] Environment variables secured

## Monitoring and Maintenance

### Health Checks

Set up monitoring for:

- Application uptime
- API response times
- Database connectivity
- OAuth token refresh rates
- Error rates

### Regular Maintenance

- Monitor MongoDB performance and storage
- Review OAuth token usage and cleanup expired tokens
- Update dependencies regularly
- Review application logs for errors
- Backup database regularly

### Performance Optimization

- Enable MongoDB query optimization
- Configure appropriate indexes for companies, users, and revenue_archives collections
- Monitor function execution times (especially revenue calculation functions)
- Optimize chart rendering for large datasets with Chart.js performance settings
- Consider CDN for static assets
- Monitor multi-month deal distribution calculations for performance impact
- Cache frequently accessed company settings

## Troubleshooting

### Common Issues

1. **OAuth Redirect Mismatch**: Ensure all redirect URIs match exactly
2. **MongoDB Connection**: Check IP whitelist and connection string
3. **Environment Variables**: Verify all required variables are set
4. **CORS Errors**: Check domain configuration in OAuth providers
5. **Chart Reference Lines Not Showing**: Verify company financial settings are properly configured
6. **Transaction Details Discrepancies**: Check that both chart and transaction detail calculations use the same multi-month distribution logic
7. **Refresh Timestamps Not Updating**: Ensure useDataRefresh composable is properly initialized

### Debug Mode

For debugging in production (temporary):
1. Set `NODE_ENV=development` temporarily
2. Check Netlify function logs
3. Monitor MongoDB Atlas logs
4. Use browser dev tools for client-side issues

## Scaling Considerations

### Current Architecture Limitations

- Serverless functions have execution time limits
- MongoDB Atlas shared clusters have connection limits
- Client-side rendering may impact large datasets

### Scaling Strategies

1. **Database Scaling**:
   - Upgrade to dedicated MongoDB cluster
   - Implement database indexing strategy
   - Consider read replicas for heavy queries

2. **Function Optimization**:
   - Implement caching layers
   - Optimize data fetching strategies
   - Use background jobs for heavy processing

3. **Client Optimization**:
   - Implement pagination for large datasets
   - Add data virtualization for tables
   - Consider server-side rendering for critical paths

## Support and Updates

### Version Management

- Tag releases in Git
- Document breaking changes
- Test OAuth flows after updates
- Validate database migrations

### Backup Strategy

- MongoDB Atlas automatic backups
- Export environment variables
- Document OAuth app configurations
- Save SSL certificates if using custom domains