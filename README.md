# BI Forecast

A multi-tenant Progressive Web Application for revenue forecasting that integrates QuickBooks Online and Pipedrive to provide accurate 3-month forecasts with 12-month visibility, historical data tracking, and offline capabilities.

## Features

- **Multi-tenant SaaS**: Support multiple companies with domain-based access control
- **Progressive Web App**: Installable on mobile devices with offline capabilities
- **Revenue Forecasting**: 6 components of monthly revenue calculation
- **Historical Data**: Daily data archiving with date selector for historical views
- **API Integrations**: QuickBooks Online and Pipedrive with OAuth2 flows
- **Real-time Charts**: Chart.js visualizations with drill-down capabilities
- **Mobile Responsive**: Optimized for mobile and desktop usage
- **Automated Refresh**: Scheduled daily data refresh at 3am ET

## Revenue Components

The application calculates monthly revenue from 6 components:

1. **Invoiced Revenue** - Posted invoices from QuickBooks Online
2. **Journal Entries** - Accounting adjustments affecting revenue  
3. **Delayed Charges** - Unbilled charges using QBO's delayed charge feature
4. **Monthly Recurring** - Estimated recurring revenue from previous month
5. **Won Unscheduled** - Pipedrive deals won but not yet scheduled for invoicing
6. **Weighted Sales** - Open Pipedrive deals weighted by probability and duration

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

5. **Start development server**
   ```bash
   npm run dev:netlify
   ```

   This starts both the Vite dev server and Netlify Functions locally.

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
   netlify deploy --prod
   ```

## Usage

### Initial Setup

1. **Admin creates company account**
   - Sign in with Google (domain validation)
   - Company automatically created from email domain

2. **Connect APIs**
   - Navigate to Settings
   - Connect QuickBooks Online via OAuth2 flow
   - Add Pipedrive API key

3. **Data Refresh**
   - Initial data load happens automatically
   - Manual refresh buttons available
   - Daily automatic refresh at 3am ET

### Daily Usage

1. **Dashboard View**
   - Key metrics: This month, 3-month, 1-year forecasts
   - 24-month revenue chart with historical data
   - Toggle weighted sales inclusion

2. **Historical Analysis**
   - Use date selector to view past forecasts
   - Compare historical vs actual performance

3. **Exception Management**
   - Review overdue Pipedrive deals
   - Monitor past delayed charges
   - Track won deals needing invoice scheduling

4. **Account Monitoring**
   - View asset account balances
   - Aged A/R reports with 15-day buckets
   - Real-time balance updates

## Architecture

### Database Collections

- **companies** - Multi-tenant company data
- **users** - User profiles with company associations  
- **oauth_tokens** - Encrypted API credentials per company
- **revenue_archives** - Daily snapshots of all revenue data
- **exceptions** - Tracked exception items

### API Endpoints

#### Authentication
- `POST /auth-google` - Google OAuth login
- `GET /auth-current` - Get current user info
- `POST /auth-logout` - Logout (client-side token removal)

#### Revenue Data  
- `GET /revenue-current` - Current revenue forecast
- `GET /revenue-historical` - Historical archived data
- `POST /revenue-refresh-qbo` - Manual QBO refresh
- `POST /revenue-refresh-pipedrive` - Manual Pipedrive refresh

#### OAuth Flows
- `GET /qbo-oauth-start` - Initiate QBO OAuth
- `GET /qbo-oauth-callback` - Handle QBO OAuth callback
- `POST /pipedrive-connect` - Save Pipedrive API key

#### Scheduled Tasks
- `POST /scheduled-archive` - Daily data archiving (3am ET)

## Security

- JWT-based authentication with 7-day expiry
- Encrypted OAuth tokens in database using AES encryption
- Domain-based company isolation
- CORS protection on all endpoints
- Input validation and sanitization
- Rate limiting (handled by Netlify)

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