# BI Forecast

A multi-tenant Progressive Web Application for revenue forecasting that integrates QuickBooks Online and Pipedrive to provide accurate 3-month forecasts with 12-month visibility, historical data tracking, and offline capabilities.

## Features

- **Multi-tenant SaaS**: Support multiple companies with domain-based access control
- **Progressive Web App**: Installable on mobile devices with manifest and service worker
- **Revenue Forecasting**: 6 components of monthly revenue calculation with real-time updates
- **Historical Data**: Daily data archiving with date selector for historical views
- **API Integrations**: QuickBooks Online OAuth2 and Pipedrive API key authentication
- **Interactive Charts**: Chart.js visualizations with drill-down transaction details and reference lines
- **Exception Tracking**: Monitor overdue deals, past charges, and unscheduled items
- **Balance Monitoring**: Asset accounts and aged A/R reporting with payment recording
- **Mobile Responsive**: Optimized for mobile and desktop with touch interactions
- **Automated Refresh**: Scheduled daily data refresh at 3am ET via Netlify functions
- **Real-time Timestamps**: Live refresh status with tooltips showing exact refresh times
- **Multi-month Deal Distribution**: Proper weighted sales calculation across project durations
- **Enhanced Transaction Details**: Comprehensive breakdowns with invoice-level details

## Revenue Components

The application calculates monthly revenue from 6 components:

1. **Invoiced Revenue** - Posted invoices from QuickBooks Online
2. **Journal Entries** - Accounting adjustments affecting revenue  
3. **Delayed Charges** - Unbilled charges using QBO's delayed charge feature
4. **Monthly Recurring** - Estimated recurring revenue from previous month
5. **Won Unscheduled** - Pipedrive deals won but not yet scheduled for invoicing
6. **Weighted Sales** - Open Pipedrive deals weighted by probability and distributed across project duration

## Tech Stack

### Frontend
- Vue.js 3 with Composition API
- Tailwind CSS for styling
- Chart.js for data visualizations
- Vue Router for navigation
- Pinia for state management
- PWA with service worker

### Backend
- Netlify Functions (serverless)
- MongoDB Atlas for data storage
- JWT authentication
- Google SSO integration
- Encrypted OAuth token storage

### APIs
- QuickBooks Online REST API
- Pipedrive REST API
- Google Auth Library

## Setup

### Prerequisites

- Node.js 20+ (for local development)
- MongoDB Atlas account
- Google OAuth2 credentials
- QuickBooks Online developer account
- Pipedrive account with API access
- Netlify account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/bi-forecast.git
   cd bi-forecast
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Required Environment Variables**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DB_NAME=bi-forecast
   JWT_SECRET=your-super-secret-jwt-key
   ENCRYPTION_KEY=your-super-secret-encryption-key
   GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
   QBO_CLIENT_ID=your-quickbooks-client-id
   QBO_CLIENT_SECRET=your-quickbooks-client-secret
   QBO_REDIRECT_URI=http://localhost:8888/.netlify/functions/qbo-oauth-callback
   URL=http://localhost:8888
   ```

5. **Start development server using Netlify**
   ```bash
   npm run dev
   ```

   This starts both the Vite dev server and Netlify Functions locally.

### Cloudflare Tunnel Setup (Optional)

For secure external access during development (useful for webhook testing or mobile device testing):

1. **Install cloudflared**
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared
   
   # Linux
   wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   
   # Windows
   # Download from https://github.com/cloudflare/cloudflared/releases
   ```

2. **Authenticate with Cloudflare**
   ```bash
   cloudflared tunnel login
   ```

3. **Create and configure tunnel**
   ```bash
   # Create tunnel
   cloudflared tunnel create bi-forecast-dev
   
   # Get tunnel ID (save this)
   cloudflared tunnel list
   ```

4. **Create config file** (`~/.cloudflared/config.yml`)
   ```yaml
   tunnel: YOUR_TUNNEL_ID
   credentials-file: /Users/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json
   
   ingress:
     - hostname: your-subdomain.yourdomain.com
       service: http://localhost:8888
     - service: http_status:404
   ```

5. **Run tunnel**
   ```bash
   # In a separate terminal
   cloudflared tunnel run bi-forecast-dev
   ```

6. **Update OAuth redirect URIs**
   - Add your tunnel URL to Google OAuth authorized origins
   - Update QBO redirect URI to use tunnel domain
   - Update `.env` with tunnel URL for `URL` variable

This allows secure HTTPS access to your local development server for webhook testing and mobile device debugging.

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google+ API
4. Create OAuth 2.0 credentials
5. Add your domain to authorized origins
6. Add redirect URIs for your authentication flow

### QuickBooks Online Setup

1. Create a [QuickBooks Developer Account](https://developer.intuit.com/)
2. Create a new app in the Developer Dashboard
3. Configure OAuth 2.0 redirect URIs
4. Get your Client ID and Client Secret
5. Set up sandbox company for testing

### Pipedrive Setup

1. Go to your Pipedrive account settings
2. Navigate to API section
3. Generate a new API token
4. Configure custom fields with the IDs specified in REQUIREMENTS.md

### Deployment

#### Netlify Deployment

1. **Connect to Netlify**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli
   
   # Login and link site
   netlify login
   netlify init
   ```

2. **Configure Environment Variables**
   - Go to Netlify dashboard > Site settings > Environment variables
   - Add all variables from `.env.example`
   - Update URLs to production values

3. **Enable Scheduled Functions**
   - Install the scheduled functions plugin
   - Configure the daily archive function to run at 3am ET

4. **Deploy**
   ```bash
   npm run deploy
   ```

## Current Implementation Status

### ✅ Fully Implemented Features

#### Dashboard
- Interactive 24-month revenue chart with Chart.js and horizontal reference lines
- Historical date selector for viewing past forecasts
- Key metrics cards (current month, 3-month, 1-year totals)
- Weighted sales toggle with real-time recalculation
- Transaction details modal with drill-down functionality and discrepancy detection
- Real-time refresh timestamps with loading indicators and tooltips
- Mobile-responsive design with touch interactions
- Company financial settings (target net margin, monthly expenses override)

#### Revenue Calculation Engine
- All 6 revenue components implemented and tested
- Real-time calculations with QuickBooks and Pipedrive data
- Multi-month deal distribution for accurate weighted sales forecasting
- Historical archive system with daily snapshots
- Manual refresh capabilities with real-time status indicators
- Enhanced transaction details with comprehensive invoice breakdowns

#### Authentication & Security
- Google SSO with domain validation
- JWT token management with secure storage
- Encrypted OAuth tokens in MongoDB
- Company-level data isolation

#### API Integrations
- QuickBooks Online OAuth2 flow fully functional
- Pipedrive API key authentication and validation
- Automated daily data refresh via Netlify scheduled functions
- Real-time API connection status monitoring

#### Exception Management
- Overdue deals tracking from Pipedrive
- Past delayed charges identification
- Won unscheduled deals monitoring
- Exception resolution workflows

#### Balance Monitoring
- Asset account balances from QuickBooks
- Aged A/R reporting with configurable buckets
- Real-time balance updates with sync timestamps

#### Progressive Web App
- PWA manifest configured for installation
- Service worker ready for implementation
- Mobile-optimized interface
- Responsive design across all screen sizes

### Usage

1. **Initial Setup**
   - Sign in with Google (creates company from email domain)
   - Connect QuickBooks via OAuth2 in Settings
   - Add Pipedrive API key in Settings
   - System automatically refreshes data

2. **Daily Operations**
   - View real-time revenue dashboard
   - Select historical dates to compare past forecasts
   - Monitor exceptions for items needing attention
   - Check asset balances and A/R aging
   - Toggle weighted sales to see impact on forecasts
   - Drill down into specific transactions via chart clicks

## Architecture

### Database Collections

- **companies** - Multi-tenant company data with financial settings
- **users** - User profiles with company associations  
- **oauth_tokens** - Encrypted API credentials per company
- **revenue_archives** - Daily snapshots of all revenue data with enhanced calculations
- **exceptions** - Tracked exception items

### Netlify Functions (API Endpoints)

#### Authentication
- `auth-google.js` - Google OAuth login
- `auth-current.js` - Get current user session
- `auth-logout.js` - Logout (client-side token removal)

#### Revenue Data  
- `revenue-current.js` - Current revenue forecast calculations
- `revenue-historical.js` - Historical archived data retrieval
- `revenue-refresh-qbo.js` - Manual QuickBooks data refresh
- `revenue-refresh-pipedrive.js` - Manual Pipedrive data refresh
- `transaction-details.js` - Drill-down transaction data for chart interactions

#### OAuth & API Management
- `qbo-oauth-start.js` - Initiate QuickBooks OAuth flow
- `qbo-oauth-callback.js` - Handle QuickBooks OAuth callback
- `pipedrive-connect.js` - Save and validate Pipedrive API key

#### Company & Settings
- `company-update.js` - Company settings management
- `settings-status.js` - API connection status checks

#### Scheduled Tasks
- `scheduled-archive.js` - Daily data archiving (3am ET)

#### Development & Testing
- `qbo-test.js` - QuickBooks API testing
- `qb-raw-data.js` - Raw QuickBooks data analysis
- `test-september-data.js` - September data validation

## Security

- JWT-based authentication with 7-day expiry
- Encrypted OAuth tokens in database using AES encryption
- Domain-based company isolation
- CORS protection on all endpoints
- Input validation and sanitization
- Rate limiting (handled by Netlify)

## Recent Enhancements

### Chart & Visualization Improvements
- **Horizontal Reference Lines**: Chart now displays monthly expense levels and target revenue lines based on configured net margins
- **Fixed Chart Totals**: Eliminated duplicate calculations that caused incorrect total labels above bars
- **Enhanced Tooltips**: Absolute datetime tooltips on hover for refresh timestamps

### Multi-month Deal Distribution
- **Accurate Weighted Sales**: Fixed multi-month Pipedrive deals to properly distribute weighted sales across their full project duration
- **Consistent Transaction Details**: Transaction details modal now uses the same multi-month logic as the main chart, eliminating discrepancies
- **Debug Improvements**: Added comprehensive logging and discrepancy warnings

### Company Financial Settings
- **Target Net Margin**: Configurable company-wide target net margin percentage (1-50%)
- **Monthly Expenses Override**: Optional override for monthly expenses used in cash flow calculations
- **Reference Line Integration**: Chart reference lines automatically update based on company settings

### User Experience Enhancements
- **Real-time Refresh Status**: Live timestamps showing when data was last refreshed with relative time display
- **Loading Indicators**: Spinner animations on refresh buttons and payment recording to prevent double-clicks
- **Enhanced Transaction Details**: Monthly recurring breakdowns now show individual invoices instead of generic "Baseline" entries
- **Sorted Invoice Lists**: Monthly recurring invoices sorted by dollar amount (highest first)

### Code Quality & Architecture
- **Eliminated Duplication**: Consolidated duplicate revenue calculator implementations
- **Reusable Composables**: Created `useDataRefresh` composable to eliminate ~130 lines of duplicate refresh logic
- **Consistent Error Handling**: Standardized error handling across refresh operations

## Future Enhancements

- Journal entry tool for revenue deferrals
- Real-time bank balance integration (Plaid)
- Date comparison views for forecast analysis
- Customer name matching across systems
- ML-based forecast predictions
- Slack/email alert integrations
- Budget vs actual comparisons
- Advanced export capabilities

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is proprietary software. All rights reserved.