# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development
```bash
npm run dev              # Start Netlify Dev (Vite + Functions)
npm run dev:local        # Start Vite only (no functions)
npm run tunnel           # Start Cloudflare tunnel for external access
```

### Testing
```bash
npm test                 # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:ui          # Open Vitest UI
npm run test:coverage    # Generate coverage report
```

### Build & Deploy
```bash
npm run build           # Build frontend for production
npm run deploy          # Build and deploy to Netlify production
```

## Architecture Overview

### Frontend (Vue 3)
- **Composition API**: All components use `<script setup>` syntax
- **State Management**: Pinia stores in `src/stores/`
- **Routing**: Vue Router with auth guards in `src/router/`
- **Composables**: Reusable logic in `src/composables/` (e.g., `useDataRefresh`, `useToast`)

### Backend (Netlify Functions)
- **Location**: `netlify/functions/`
- **Style**: CommonJS (not ES modules) for AWS Lambda compatibility
- **Services**: Shared business logic in `netlify/functions/services/`
  - `revenue-calculator.js` - Core revenue calculation engine
  - `quickbooks.js` - QB API wrapper with caching
  - `pipedrive.js` - Pipedrive API wrapper
  - `transaction-details-cache.js` - Prefetching service

### Database (MongoDB)
Collections:
- `companies` - Multi-tenant company data
- `users` - User profiles with company associations
- `oauth_tokens` - Encrypted API credentials
- `revenue_archives` - Daily snapshots (created at 3am ET)
- `transaction_details_cache` - 6-month prefetch cache (30-day TTL)
- `client_aliases` - Name mappings for revenue attribution

## Critical Patterns & Conventions

### Date Handling (Timezone Safety)
**ALWAYS** use date-only strings (`YYYY-MM-DD`) when passing dates between frontend and backend to avoid timezone shifts. Never use `.toISOString()` for dates.

```javascript
// ✅ CORRECT - Date-only string
const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
api.get(`/endpoint?date=${dateStr}`)

// ❌ WRONG - Will shift dates across timezones
api.get(`/endpoint?date=${date.toISOString()}`)
```

Backend parsing:
```javascript
// Parse YYYY-MM-DD as UTC midnight to avoid timezone issues
const [year, month, day] = dateStr.split('-').map(Number)
const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
```

### API Optimization (Rate Limiting)
QuickBooks has a 500 req/min limit. The codebase uses several strategies:

1. **100ms spacing** between API calls in `revenue-calculator.js`
2. **Data caching** - QBO/Pipedrive data cached in calculator instance
3. **Archive reuse** - Pipedrive refresh loads existing QB data from today's archive
4. **Pass cached data** - `getBalances()` accepts `monthsData` and `qboData` parameters

When modifying revenue calculations, always pass cached data to avoid N+1 queries:
```javascript
const revenueResult = await calculator.calculateMonthlyRevenue(18, -6)
const balances = await calculator.getBalances(
  revenueResult.months,  // Pass months to avoid re-fetching
  calculator.cachedQBOData  // Pass cached data
)
```

### Authentication Flow
- **Development**: `BYPASS_AUTH_LOCALHOST=true` skips auth on localhost
- **Production**: JWT tokens with 7-day expiry
- **OAuth Tokens**: AES-encrypted in MongoDB using `ENCRYPTION_KEY`

### Revenue Calculation Components
6 components make up monthly revenue (in order):
1. Invoiced Revenue (QB invoices)
2. Journal Entries (QB accounting adjustments)
3. Delayed Charges (QB unbilled items)
4. Monthly Recurring (baseline from previous month)
5. Won Unscheduled (Pipedrive won deals not yet scheduled)
6. Weighted Sales (Pipedrive open deals × probability, distributed across duration)

### Transaction Caching Strategy
- **Prefetch Window**: 6 months (prev 2, current, next 3)
- **Trigger**: Background job during QB/PD refresh
- **Purpose**: Instant chart drill-down without API calls
- **TTL**: 30 days in MongoDB

## File Organization

### Netlify Functions
- `auth-*.js` - Authentication endpoints
- `revenue-*.js` - Revenue data endpoints
- `qbo-*.js` - QuickBooks OAuth flow
- `scheduled-*.js` - Cron jobs (daily archive at 3am ET)
- `utils/` - Shared utilities (auth, database, response helpers)
- `services/` - Business logic (keep functions thin, logic in services)

### Frontend
- `views/` - Page components (Dashboard, Settings, etc.)
- `components/` - Reusable UI components
- `stores/` - Pinia state (auth, revenue)
- `composables/` - Reusable composition functions
- `services/` - API client wrappers

## Testing

Tests use Vitest + Vue Test Utils. Run `npm run test:ui` for the best experience.

Key test files:
- `src/**/__tests__/*.test.js` - Component/store tests
- `netlify/functions/utils/__tests__/*.test.js` - Backend utility tests

## Important Environment Variables

Required for local development (see `.env.example`):
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - For auth tokens
- `ENCRYPTION_KEY` - For encrypting OAuth tokens
- `GOOGLE_CLIENT_ID` - Google SSO
- `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` - QuickBooks OAuth
- `BYPASS_AUTH_LOCALHOST` - Set to "true" for local dev

## Common Gotchas

1. **Port conflicts**: Netlify dev uses port 8888. If running multiple instances, change `targetPort` in `netlify.toml`

2. **Weighted sales toggle**: Transaction details modal must sync with Dashboard toggle state. Always pass `includeWeightedSales` parameter.

3. **Archive dates**: Archives are created at 3am ET daily. Comparison dates before the first archive will 404.

4. **Client aliases**: Revenue attribution requires client name matching. Use the client aliases system for consistent tracking across QB and Pipedrive.

5. **Debouncing**: Refresh operations have 20-second debounce. Date inputs have 1-second debounce before loading data.

## Architecture Decisions

### Why CommonJS for functions?
AWS Lambda (which powers Netlify Functions) requires CommonJS. All `netlify/functions/**/*.js` files use `require()` and `module.exports`.

### Why separate refresh endpoints?
- `revenue-refresh-qbo.js` - Full QB refresh (8 API calls)
- `revenue-refresh-pipedrive.js` - PD only, reuses today's QB archive (2 API calls)
- Allows targeted refreshes to minimize API usage

### Why 6-month transaction cache?
Balances chart drill-down performance against storage. Covers typical user navigation patterns (prev 2 months, current, next 3).

### Why archives instead of live calculation?
- Provides historical "point in time" views
- Reduces API calls (reuse archived data)
- Enables comparison features
- Scheduled archiving ensures fresh data each morning
