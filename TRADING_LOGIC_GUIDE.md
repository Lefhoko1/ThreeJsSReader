# StarBot Trading Logic - Complete Implementation Guide

## Overview

The StarBot Trading Logic implements the complete trading workflow as specified in the trading logic prompt. It's a sophisticated system for automated binary options trading with the following key features:

- **Signal Generation**: Monitors MA5 crossovers across all volatility indices
- **Session Management**: Creates and manages 150-minute trading sessions (5 × 30-minute candles)
- **Intelligent Bet Scaling**: Calculates bet amounts for each level (1-5) with pattern-based analysis
- **Loss Exclusion**: Automatically excludes losing patterns from subsequent bets
- **Session Evaluation**: Determines session wins/losses after 5 candle closes

## Architecture

### Main Components

#### 1. **StarBotTradingLogic** (`app/lib/tradinglogic.ts`)
The core orchestrator class that manages all trading operations.

**Key Methods:**
- `initializeBot()` - Initializes bot on startup
- `processTradingCycle()` - Main entry point triggered by Firebase API
- `checkAndGenerateSignals()` - Analyzes markets for MA5 crossovers
- `createAndSeedSession()` - Creates new session and seeds database
- `handleActiveSession()` - Manages ongoing trading session
- `executeBet()` - Places trades on Deriv
- `evaluateSessionCompletion()` - Determines session result after 5 bets

#### 2. **API Endpoint** (`app/api/trading-bot/route.ts`)
Firebase trigger integration point.

**Routes:**
- `POST /api/trading-bot` - Triggered by Firebase stored procedure (requires `x-cron-secret` header)
- `GET /api/trading-bot` - Returns bot status and configuration
- `OPTIONS /api/trading-bot` - CORS preflight

## Trading Workflow

### Phase 1: Initialization
```
Bot Start → Initialize Services → Create Tables → Connect to Deriv → Wait for Signals
```

### Phase 2: Signal Detection (Every 30 Minutes)
```
Firebase Trigger → Check All Volatility Indices → Detect MA5 Crossover
    ↓
Find Best Trending Symbol → Confirm Signal
    ↓
Create New Session (150 minutes) → Seed Pattern Tables
```

### Phase 3: First Bet
```
Seed Data for 16 Patterns (based on trend) → Calculate First Bet Amount
    ↓
Place Trade via Deriv (30-minute expiry) → Record in Database
```

### Phase 4: Ongoing Cycle (Bets 2-5)
```
Wait 30 Minutes → Get Latest Candle → Update Bet Results
    ↓
Check for Losing Tables → Exclude from Further Trading
    ↓
Calculate Next Bet → Place Trade (if tables remain)
    ↓
Repeat until 5 bets complete
```

### Phase 5: Session Evaluation
```
After 5 Bets → Check if any pattern has 5-0 win record
    ↓
Session Won: At least one pattern 5-0 → Session Lost: No pattern 5-0
    ↓
Update Database → Check for New Signals
```

## Database Schema

### Sessions Table
```typescript
{
  id: number (PK)
  sessionid: string (unique) - "SYMBOL_timestamp"
  symbol: string - Trading symbol (e.g., "R_100")
  sessionresult: "win" | "loss" | null
  firstbetAmount: number
  createdAt: Date
  updatedAt: Date
}
```

### Pattern Tables (32 tables total)
One table per candle pattern (RRRRR, RRRRG, ..., GGGGG)

```typescript
{
  id: number (PK)
  sessionid: string (FK)
  sessionresult: string
  bet1Amount, bet1Result, bet1actual, bet1expectedcandle
  bet2Amount, bet2Result, bet2actual, bet2expectedcandle
  bet3Amount, bet3Result, bet3actual, bet3expectedcandle
  bet4Amount, bet4Result, bet4actual, bet4expectedcandle
  bet5Amount, bet5Result, bet5actual, bet5expectedcandle
  createdAt: Date
  updatedAt: Date
}
```

## Key Business Rules

### 1. Signal Confirmation
- MA5 crossover with positive slope is required
- Must close of 30-minute candle
- Signal = bullish crossover (uptrend) OR bearish crossover (downtrend)

### 2. Trend Selection
- **Uptrend Signal**: Trade 16 uptrend patterns
- **Downtrend Signal**: Trade 16 downtrend patterns

### 3. Loss Exclusion (Critical)
```typescript
"If first candle for a table loses → exclude from remainder of session"
Example:
  - Bet 1: Pattern A loses → Exclude Pattern A from bets 2-5
  - Bet 2: Pattern B loses → Exclude Pattern B from bets 3-5
  - Continue... Only winning patterns stay active
```

### 4. Session Win Condition
```typescript
"At least one pattern must have won all 5 bets in the session"
Example:
  - Pattern A: W, W, W, W, W = Session WIN
  - Pattern B: W, L, -, -, - = Excluded
  - Pattern C: W, W, L, -, - = Excluded
  → Result: Session WINS (Pattern A achieved 5-0)
```

### 5. Market Analysis Timing
```typescript
"Market analysis only when:"
- No active session exists, OR
- Fifth bet has been updated (session complete)
```

## Environment Variables

```env
# Deriv API Configuration
DERIV_APP_ID=<integer>                              # Deriv app ID
DERIV_API_TOKEN=<string>                           # Deriv API token
DERIV_WS_URL=wss://ws.binaryws.com/websockets/v3  # WebSocket URL

# Firebase Integration
CRON_SECRET=<secret>                               # Validates Firebase trigger
```

## Configuration

### Session Duration
- **Total**: 150 minutes (5 × 30-minute candles)
- **Bet Expiry**: 30 minutes each
- **Candle Timeframe**: M30 (30-minute)

### Pattern Coverage
- **Uptrend Patterns**: 16 tables for bullish signals
- **Downtrend Patterns**: 16 tables for bearish signals
- **Total Tables**: 32 pattern tables

### Bet Levels
1. **First Bet**: Initial system-determined amount
2. **Second Bet**: Scale based on first bet result
3. **Third Bet**: Scale based on second bet result
4. **Fourth Bet**: Scale based on third bet result
5. **Fifth Bet**: Scale based on fourth bet result

## API Usage

### Firebase Setup

Configure Firebase Cloud Functions to call the bot:

```javascript
// Firebase Cloud Function (scheduled to run every 30 minutes)
exports.triggerTradingBot = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async (context) => {
    const response = await fetch(
      'https://your-app.vercel.app/api/trading-bot',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET
        },
        body: JSON.stringify({ trigger: 'firebase-schedule' })
      }
    );
    console.log('Trading bot triggered:', response.status);
  });
```

### Manual Testing

```bash
# Health check
curl https://your-app.vercel.app/api/trading-bot

# Trigger trading cycle (replace SECRET with actual cron secret)
curl -X POST https://your-app.vercel.app/api/trading-bot \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: SECRET" \
  -d '{"trigger": "manual-test"}'
```

### Response Examples

#### Success Response
```json
{
  "success": true,
  "message": "Trading cycle processed successfully",
  "botState": {
    "isInitialized": true,
    "isWaitingForSignal": false,
    "activeSessionId": "R_100_1673456789",
    "lastProcessedCandle": "2024-01-10T14:30:00Z"
  },
  "duration_ms": 1250,
  "timestamp": "2024-01-10T14:31:00Z"
}
```

#### Status Response
```json
{
  "status": "running",
  "botState": {
    "isInitialized": true,
    "isWaitingForSignal": false,
    "activeSessionId": "R_100_1673456789",
    "sessionStartTime": "2024-01-10T13:00:00Z"
  },
  "seededTables": [
    {
      "pattern": "RRGGG",
      "trend": "uptrend",
      "excludeFromTrading": false,
      "betLevel": 2
    },
    ...
  ]
}
```

## Monitoring & Debugging

### Bot State
```typescript
const botState = tradingBot.getBotState();
// Returns: {
//   isInitialized: boolean
//   isWaitingForSignal: boolean
//   activeSessionId: string | null
//   sessionStartTime: Date | null
//   lastProcessedCandle: Date | null
// }
```

### Seeded Tables
```typescript
const seededTables = tradingBot.getSeededTables();
// Returns array of {
//   pattern: CandlePattern
//   trend: 'uptrend' | 'downtrend'
//   excludeFromTrading: boolean
//   betLevel: number
// }
```

### Console Output
The system logs comprehensive information:
```
🤖 StarBot initializing...
✅ StarBot initialized successfully, waiting for signals...
📊 Checking for trading signals...
✅ Signal confirmed for R_100 (up)
🔧 Creating session for R_100...
✅ Session created: R_100_1673456789, Duration: 150 minutes
🌱 Seeding database tables for uptrend...
✅ Seeded 16 pattern tables
💰 Executing bet 1 for session R_100_1673456789...
✅ Bet 1 placed for pattern RRGGG: {...}
📈 Updating results for bet 1...
✅ Updated pattern RRGGG bet 1: win
🚫 Excluded pattern RRRRR due to loss at bet level 1
🏁 Evaluating session completion...
✅ Session won! Pattern RRGGG had all wins
📊 Session result: win
```

## Integration with Existing Services

### Services Used
1. **SessionService** - Create and manage sessions
2. **BetRecordService** - Store bet data in pattern tables
3. **DerivTradingService** - Execute trades on Deriv
4. **DerivDataCandleService** - Fetch completed candles
5. **MarketAnalysisIndicators** - Detect MA5 crossovers
6. **StrategyCore** - Calculate bet amounts

### Data Flow
```
Firebase Trigger
    ↓
Trading Logic (Orchestrator)
    ├→ MarketAnalysisIndicators (Signal Detection)
    ├→ SessionService (Session Management)
    ├→ BetRecordService (Data Storage)
    ├→ StrategyCore (Bet Calculation)
    ├→ DerivTradingService (Trade Execution)
    └→ DerivDataCandleService (Candle Data)
    ↓
Database
```

## Future Enhancements

The code structure allows for easy modifications:

### 1. Add New Indicators
```typescript
// In tradinglogic.ts - replace determineBetResult()
// Add RSI, Bollinger Bands, or other indicators
```

### 2. Adjust Risk Parameters
```typescript
// Modify bet amounts in executeBet()
// Adjust session duration or candle timeframes
// Change exclusion logic for failed patterns
```

### 3. Add Monitoring/Alerts
```typescript
// Add webhook notifications on session completion
// Send email/SMS alerts on losing sessions
// Store metrics in analytics database
```

### 4. Implement Advanced Strategies
```typescript
// Add money management rules
// Implement position sizing based on account balance
// Add daily/weekly profit targets
```

## Troubleshooting

### Common Issues

**Issue**: Signal not detected
- **Check**: MA5 and MA10 crossover logic in MarketAnalysisIndicators
- **Check**: Candle data is being stored properly
- **Check**: All volatility symbols are available

**Issue**: Bets not executing
- **Check**: Deriv API credentials in environment variables
- **Check**: Account has sufficient balance
- **Check**: WebSocket connection is stable

**Issue**: Session not persisting
- **Check**: Database connection is active
- **Check**: Session tables have proper schema
- **Check**: No race conditions in concurrent requests

**Issue**: Patterns being excluded incorrectly
- **Check**: Match loss detection logic with your expected candle analysis
- **Verify**: Bet result calculation matches your strategy

## Performance Considerations

- **Database**: Indexes on `sessionid` and timestamps recommended
- **WebSocket**: Reconnection logic handles temporary failures
- **Concurrency**: Single session at a time by design
- **API Rate Limits**: Deriv API throttling handled internally

## Security

- Uses `x-cron-secret` header to validate Firebase calls
- Never logs sensitive token data
- WebSocket connections are encrypted
- Session IDs are tracked for audit trails

## Support & Maintenance

**Key Files:**
- Core Logic: `app/lib/tradinglogic.ts`
- API Route: `app/api/trading-bot/route.ts`
- Services: `app/lib/services/`
- Models: `app/lib/models/`

**Code Separation Principle:**
Market analysis code is completely separated from trading logic to allow independent improvements without affecting other components.

---

**Last Updated**: 2024
**Version**: 1.0
