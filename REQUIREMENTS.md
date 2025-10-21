# BI-Forecast Product Requirements Document v2.0

## Executive Summary
A multi-tenant Progressive Web Application for revenue forecasting that integrates QuickBooks Online and Pipedrive to provide accurate 3-month forecasts with 12-month visibility, historical data tracking, and offline capabilities for management teams.

## Technical Architecture

### Stack
- **Frontend**: Vue.js 3, Tailwind CSS, Chart.js, PWA with Service Workers
- **Backend**: Netlify Functions (serverless)
- **Database**: MongoDB Atlas
- **Authentication**: JWT with Google SSO
- **APIs**: QuickBooks Online REST API, Pipedrive REST API
- **Charts**: Chart.js for all visualizations

### Database Schema

```javascript
// Companies Collection
{
  _id: ObjectId,
  name: String,
  domain: String, // For Google SSO validation
  settings: {
    defaultCurrency: "USD",
    fiscalYearStart: Date,
    archiveRetentionDays: Number // Default: 365
  },
  createdAt: Date,
  updatedAt: Date
}

// Users Collection
{
  _id: ObjectId,
  email: String,
  name: String,
  googleId: String,
  companies: [ObjectId], // References to Companies
  lastLogin: Date,
  createdAt: Date
}

// OAuth Tokens Collection
{
  _id: ObjectId,
  companyId: ObjectId,
  service: "qbo" | "pipedrive",
  accessToken: String (encrypted),
  refreshToken: String (encrypted),
  realm: String, // QBO specific
  expiresAt: Date,
  updatedAt: Date
}

// Revenue Archive Collection (Daily Snapshots)
{
  _id: ObjectId,
  companyId: ObjectId,
  archiveDate: Date, // Date of snapshot
  months: [{
    month: Date, // First day of month
    components: {
      invoiced: Number,
      journalEntries: Number,
      delayedCharges: Number,
      monthlyRecurring: Number,
      wonUnscheduled: Number,
      weightedSales: Number
    },
    transactions: Array, // Detailed breakdown
  }],
  exceptions: {
    overdueDeals: Array,
    pastDelayedCharges: Array,
    wonUnscheduled: Array
  },
  balances: {
    assets: Array,
    receivables: Object
  },
  createdAt: Date
}

// Exceptions Collection
{
  _id: ObjectId,
  companyId: ObjectId,
  type: "overdue_deal" | "past_delayed_charge" | "won_unscheduled",
  data: Object,
  resolvedAt: Date,
  createdAt: Date
}

// Client Aliases Collection
{
  _id: ObjectId,
  companyId: ObjectId,
  primaryName: String, // The canonical client name
  aliases: [String], // Alternative names/variations
  createdAt: Date,
  updatedAt: Date
}
```

## Core Features

### 1. Revenue Dashboard
- **Historical Date Selector** (Top of page)
  - Date picker to view any archived snapshot
  - "Viewing as of [date]" indicator when historical
  - Real-time vs historical mode toggle

- **Chart.js Stacked Bar Chart** (24 months: past 12 + future 12)
  - Components: Invoiced, Journal Entries, Delayed Charges, Monthly Recurring, Won Unscheduled, Weighted Sales
  - Mobile-responsive with touch interactions
  - Hover: Show component values
  - Click: Show client revenue breakdown modal
  - Transaction details drill-down available in modal
  - Pinch-to-zoom on mobile

### 2. Key Metrics
- **This Month Revenue Forecast**: Sum of all components for current month
- **3-Month Revenue Forecast**: Rolling 3-month total
- **1-Year Unbilled Charges**: Total delayed charges for next 12 months
- **Toggle**: Exclude/include weighted sales in forecasts

### 3. Revenue Components

#### From QuickBooks Online:
- **Invoiced Revenue**: Posted invoices by date
- **Journal Entries**: Accounting adjustments affecting revenue
- **Delayed Charges**: Using Charge report type via `reportTransactionList`
- **Monthly Recurring**: Previous month's revenue with "Monthly" in income account name

#### From Pipedrive:
- **Won Unscheduled**: Deals with 100% probability where `invoices_scheduled` = false
- **Weighted Sales**: 
  - Formula: `(deal_value × probability) ÷ project_duration`  
  - Distribution: Spread across project duration starting from expected close date
  - Multi-month support: Properly distributes deals across multiple months
  - Start date: `project_start_date` (custom field) or `expected_close_date`
  - Exclude if `invoices_scheduled` = true

### 4. Exceptions Page
- **Overdue Pipedrive Deals**: Open deals past expected close date
- **Past Delayed Charges**: Delayed charges with dates < today
- **Won Unscheduled Deals**: All deals needing invoice scheduling

### 5. Client Revenue Breakdown
- **Client Detail Modal**
  - Triggered by clicking any month on the revenue chart
  - Shows revenue breakdown by client for selected month
  - Sorted by total revenue (highest first)
  - Includes all 6 revenue components attributed to each client

- **Client Alias System**
  - Maps alternative client names to primary/canonical names
  - Resolves name variations across QuickBooks and Pipedrive
  - Managed via Settings page
  - Two-tier matching: entity references → description text matching

- **Revenue Attribution Logic**
  - Invoices: Direct customer reference
  - Journal Entries: Entity reference or description matching
  - Delayed Charges: Direct customer reference
  - Monthly Recurring: Based on previous month's client data
  - Won Unscheduled: Pipedrive organization name
  - Weighted Sales: Pipedrive organization name

### 6. Balances Page
- **Asset Accounts from QBO**
  - Bank accounts with current balances
  - Credit card accounts
  - Other asset accounts
  - Last sync timestamp
- **Aged A/R Report**
  - Buckets: Current, 15 days, 30 days, 45 days, 60+ days
  - Total A/R balance
  - Drill-down by customer

### 7. Settings Page
- **API Connections**
  - QuickBooks OAuth status and reconnect
  - Pipedrive API key management
  - Connection status indicators

- **Client Alias Management**
  - List all clients with collapsible edit forms
  - Inline editing (no separate form at bottom)
  - Add alternative names/aliases per client
  - Individual Save/Delete buttons per client
  - Toast notifications for feedback
  - Auto-save on form submission

- **Company Settings**
  - Target net margin percentage
  - Monthly expenses override
  - Financial settings for charts

### 8. Progressive Web App Features
- **Installation**
  - App manifest for home screen installation
  - Custom app icon and splash screen
  - Standalone mode (no browser chrome)

- **Offline Capabilities**
  - Service worker with cache-first strategy
  - Cache last 7 days of archive data
  - Offline indicator in UI
  - Background sync when reconnected

- **Performance**
  - Lazy loading for routes
  - Image optimization
  - Compressed asset delivery
  - IndexedDB for local storage

## Data Management

### Daily Archiving
- **Automatic Snapshot**: 3am ET daily
- **Archive Contents**:
  - Complete revenue forecast for all months
  - All transaction details
  - Exception items
  - Asset balances
  - A/R aging
- **Retention**: 365 days default (configurable per company)

### Data Refresh
- **Automatic**: 3am ET daily via Netlify scheduled function
- **Manual**: Refresh buttons per data source
- **Incremental**: Only fetch changes since last sync

## API Integrations

### QuickBooks Online
- OAuth2 flow for authorization
- Endpoints needed:
  - `/v3/company/{realmId}/reports/TransactionList` (delayed charges)
  - `/v3/company/{realmId}/reports/ProfitAndLoss` (monthly revenue)
  - `/v3/company/{realmId}/query` (invoices, journal entries)
  - `/v3/company/{realmId}/reports/AgedReceivables`
  - `/v3/company/{realmId}/reports/BalanceSheet` (asset balances)
  - `/v3/company/{realmId}/account` (account list and balances)

### Pipedrive
- API key authentication
- Custom fields:
  - `project_duration`: 3a1ab14edd3330c02bbbbfa0535a042bcd4a7fff
  - `project_start_date`: a82757d0f7820a7d15dface24eb041eede43ac1a
  - `invoices_scheduled`: 93bdab5b65406067ccdc160849aa7324a0283036
- Endpoints:
  - `/deals/timeline`
  - `/deals` (with filters)

## User Flow

1. **Initial Setup**
   - Admin creates company account
   - Connects QBO via OAuth2
   - Adds Pipedrive API key
   - Invites team members

2. **PWA Installation**
   - Prompt to install on first visit (mobile)
   - Add to home screen
   - Opens in standalone mode

3. **Daily Usage**
   - Google SSO login (cached for offline)
   - View dashboard with cached data if offline
   - Select historical dates to view past forecasts
   - Toggle weighted sales on/off
   - Review exceptions and balances tabs

## Mobile Optimization
- **PWA-specific**
  - Touch gestures (swipe between months)
  - Pull-to-refresh
  - Bottom tab navigation
  - Viewport meta tags

- **Responsive Design**
  - Mobile-first approach
  - Breakpoints: 640px, 768px, 1024px
  - Condensed tables on small screens
  - Horizontal scroll for wide content

## Security Requirements
- Encrypted OAuth tokens in database
- Company-level data isolation
- Domain-validated Google SSO
- API rate limiting
- Audit logging for data access
- HTTPS only
- Content Security Policy headers

## Performance Targets
- Dashboard load: <2 seconds (cached), <4 seconds (fresh)
- Time to Interactive: <3 seconds
- Lighthouse PWA score: >90
- Offline functionality: 100% for viewing
- Support 100 concurrent users
- 99.9% uptime SLA

## Recent Major Enhancements (Phase 3 Completed)

### Chart & Visualization Improvements
- **Horizontal Reference Lines**: Added configurable reference lines showing monthly expense levels and target revenue based on net margin settings
- **Chart Total Fixes**: Resolved duplicate calculation issues causing incorrect total labels above stacked bars
- **Enhanced User Experience**: Added loading spinners, refresh timestamps, and tooltip enhancements

### Multi-month Deal Distribution
- **Accurate Weighted Sales Calculation**: Fixed critical bug where multi-month Pipedrive deals were only showing in one month instead of being distributed across their full project duration
- **Consistent Logic**: Ensured transaction details modal uses the same distribution logic as the main chart
- **Debug & Monitoring**: Added comprehensive logging and discrepancy detection between chart and transaction totals

### Company Financial Settings
- **Target Net Margin Configuration**: Added company-wide configurable target net margin (1-50%) used for reference line calculations
- **Monthly Expenses Override**: Optional override for monthly expenses affecting cash flow and reference line calculations
- **Settings Persistence**: Fixed settings not persisting across page reloads

### Enhanced Transaction Details
- **Monthly Recurring Breakdown**: Replaced generic "Baseline" entries with detailed individual invoice breakdowns showing actual source invoices
- **Sorted Invoice Lists**: Monthly recurring invoices now sorted by dollar amount (highest first) for better visibility
- **Historical vs Future Logic**: Different handling for past months (actual invoices) vs future months (projected from previous month)

### Code Quality & Architecture
- **Eliminated Code Duplication**: Consolidated duplicate revenue calculator implementations, removing 600+ lines of duplicate code
- **Reusable Composables**: Created `useDataRefresh` Vue composable eliminating ~130 lines of duplicate refresh logic across Dashboard and Settings
- **Improved Error Handling**: Standardized error handling and added user-friendly loading states

### Payment & A/R Enhancements
- **Payment Recording Protection**: Added loading spinner and disabled state to payment recording button to prevent double-clicks and duplicate payments
- **Enhanced A/R Management**: Improved accounts receivable tracking with better payment workflows

## Future Enhancements

### Phase 4 (Next)
- **Journal Entry Tool**
  - Create revenue deferral entries
  - Debit: Project revenue → Credit: Unearned Revenue
  - Automatic reversal on specified date
  - QBO journal entry API integration

- **Real-time Bank Balances**
  - QBO banking connection balances (preferred)
  - Plaid integration fallback
  - Show book vs actual balance

- **Date Comparison View**
  - Compare forecasts between two dates
  - Visualize changes (additions/removals)
  - Delta analysis for each component

### Phase 3
- Customer name matching across systems
- Budget vs actual comparisons
- Email/Slack alerts for forecast changes
- Export to Excel/PDF
- Additional API integrations
- Forecast accuracy tracking
- ML-based predictions

## Implementation Status

### ✅ COMPLETED - Phase 1: Core MVP
1. ✅ Project setup (Vue 3, Tailwind, PWA)
2. ✅ Database schema and auth (Google SSO)
3. ✅ QBO OAuth2 and basic API integration
4. ✅ Pipedrive integration
5. ✅ Revenue calculation engine
6. ✅ Dashboard with Chart.js
7. ✅ Daily archiving system

### ✅ COMPLETED - Phase 2: Full Features
1. ✅ Exceptions page
2. ✅ Balances page
3. ✅ Historical date selector
4. ✅ Drill-down views (Transaction Details Modal)
5. ✅ PWA functionality with manifest
6. ✅ Mobile optimizations

### ✅ COMPLETED - Phase 3: Enhanced Features & Polish
1. ✅ Core functionality testing
2. ✅ Multi-month deal distribution fixes
3. ✅ Chart enhancements with reference lines  
4. ✅ Company financial settings
5. ✅ Enhanced transaction details with invoice breakdowns
6. ✅ Real-time refresh status indicators
7. ✅ Code quality improvements and deduplication
8. ✅ Security implementation (JWT, encryption)
9. ✅ Documentation (comprehensive updates)
10. ✅ Deployment to Netlify ready

### 🚧 IN PROGRESS - Phase 4: Final Polish & Deploy
1. 🚧 Performance optimization
2. 📋 User training (pending deployment)
3. 📋 Production monitoring setup

## Current Implementation Details

### ✅ Implemented Features

#### Core Infrastructure
- Vue.js 3 with Composition API and Pinia state management
- Tailwind CSS responsive design
- Progressive Web App with manifest and service worker ready
- Netlify Functions serverless backend (17 functions implemented)
- MongoDB integration with encrypted OAuth tokens
- JWT authentication with Google SSO

#### Revenue Dashboard
- Chart.js stacked bar chart with 24-month view
- Historical date selector for archived data viewing
- Key metrics display (current month, 3-month, 1-year forecasts)
- Weighted sales toggle functionality
- Transaction details drill-down modal

#### Data Sources & Integrations
- QuickBooks Online OAuth2 flow and API integration
- Pipedrive API key authentication and data fetching
- Daily automated archiving system (scheduled function)
- Manual refresh capabilities for both QBO and Pipedrive

#### Revenue Components (All 6 Implemented)
- Invoiced Revenue from QBO
- Journal Entries from QBO
- Delayed Charges from QBO
- Monthly Recurring Revenue estimation
- Won Unscheduled deals from Pipedrive
- Weighted Sales calculations from Pipedrive

#### Additional Pages
- Exceptions page for tracking overdue/problematic items
- Balances page for asset accounts and A/R aging
- Settings page for API connections and company management

#### Backend Functions
- `auth-google.js` - Google OAuth authentication
- `auth-current.js` - Current user session management
- `qbo-oauth-start.js` / `qbo-oauth-callback.js` - QBO OAuth flow
- `revenue-current.js` - Real-time revenue calculations
- `revenue-historical.js` - Historical archive data retrieval
- `revenue-refresh-qbo.js` / `revenue-refresh-pipedrive.js` - Manual data refresh
- `scheduled-archive.js` - Daily archiving automation
- `transaction-details.js` - Drill-down transaction data
- `company-update.js` - Company settings management
- `settings-status.js` - API connection status checks

### 📋 Remaining Tasks

#### Performance Optimization
- Service worker implementation for offline functionality
- IndexedDB caching for offline data access
- Image optimization and lazy loading
- Bundle size optimization

#### Testing & Quality Assurance
- End-to-end testing with real API data
- Performance testing under load
- Mobile device testing across platforms
- Cross-browser compatibility testing

#### Production Readiness
- Environment-specific configuration
- Error monitoring and logging
- API rate limiting implementation
- Data backup and recovery procedures

## Revenue Component Details

### Total Monthly Revenue Components:
1. **Invoiced Revenue** (QBO)
   - Already sent invoices showing in QuickBooks

2. **Journal Entries** (QBO)
   - Accounting adjustments to move recognized revenue between months

3. **Delayed Charges** (QBO)
   - Unbilled charges from QBO
   - Retrieved using 'Charge' report type via `reportTransactionList` API
   - Recurring templates create charges 365 days in advance

4. **Monthly Recurring Invoices** (QBO)
   - Estimated from previous month's revenue
   - Identified by "Monthly" in income account name

5. **Won Unscheduled** (Pipedrive)
   - Deals with 100% probability
   - Where `invoices_scheduled` flag = false

6. **Weighted Sales** (Pipedrive)
   - Formula: `(deal_value × probability) ÷ project_duration`
   - Start on `project_start_date` if provided, otherwise `expected_close_date`
   - Spread evenly across project duration months

## Pipedrive Custom Fields
- **project_duration**: `3a1ab14edd3330c02bbbbfa0535a042bcd4a7fff`
- **project_start_date**: `a82757d0f7820a7d15dface24eb041eede43ac1a`
- **invoices_scheduled**: `93bdab5b65406067ccdc160849aa7324a0283036`

## Key Features Summary
- Multi-tenant SaaS application
- Progressive Web App with offline support
- Daily data archiving with historical viewing
- Mobile-responsive with Chart.js visualizations
- Google SSO authentication
- Automated 3am ET data refresh
- Exception tracking and reporting
- Asset balance monitoring
- Aged A/R reporting (15-day buckets)