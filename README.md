# AuTick: Minimal XAUUSD Market Replay & Paper Trading Simulator

A minimal, functional, browser-based historical market replay and simulated paper trading terminal exclusively for **XAUUSD (Gold / US Dollar)**.

Built with **Next.js (App Router)**, **TypeScript**, **TradingView Lightweight Charts**, **Zustand**, and **Tailwind CSS**, powered by **Bun**.

---

## 1. Features

- **Historical XAUUSD Market Data**:
  - Live server-side proxy route (`/api/market-data`) fetching real 1-minute historical candlestick data.
  - Pluggable provider adapter architecture supporting:
    - **Bybit Linear Perpetual API** (`symbol=XAUUSDT`, public 1-minute historical candles, no API key required).
    - **Twelve Data API** (`symbol=XAU/USD`, spot historical candles via optional `TWELVE_DATA_API_KEY`).
  - Validation, chronological sorting, and deduplication of historical candles.
  - Strict preservation of price integrity (never fabricates prices or substitutes random data).

- **Deterministic Market Replay Engine**:
  - Pure TypeScript replay engine decoupled from React and charting rendering.
  - Virtual market clock tracking the authoritative historical candle index.
  - Single-candle step forward, Play, Pause, Reset, and Jump-to-timestamp controls.
  - Playback speeds: **1×** (1s/candle), **2×**, **5×**, and **10×**.
  - **Zero Future-Data Leakage**: Only candles up to the current replay index are exposed to the chart and trading engine.

- **Simulated Paper Trading Engine**:
  - Pure TypeScript paper trading engine.
  - **LONG** and **SHORT** market positions.
  - Configurable quantity in **Troy Ounces** (1 unit = 1 troy ounce of gold).
  - Optional **Stop Loss (SL)** and **Take Profit (TP)** levels.
  - Real-time Balance, Equity, Realized P&L, and Unrealized P&L calculations.
  - Interactive manual position closure.
  - Single open position constraint with order validation.

- **Professional Trading Terminal UI**:
  - Dark terminal aesthetic with crisp gold accents.
  - TradingView Lightweight Charts (v5) with custom dark theme, zooming, and panning.
  - Live visual price lines: Entry (Cyan dashed), Stop Loss (Red dotted), Take Profit (Green dotted).
  - Chronological chart markers for trade entries and exits.
  - Live trade history ledger with win rate, exit reasons, and gross/net P&L breakdown.

- **Zero Persistence Architecture**:
  - 100% in-memory page session state.
  - No localStorage, cookies, IndexedDB, or database.
  - Reloading the page cleanly resets all positions, trades, and balances to their initial state.

---

## 2. Trade Execution Model & Assumptions

1. **Market Entry Model**:
   - Market orders execute at the close price of the currently active replay candle.
   - Entry timestamp is recorded as the candle timestamp.

2. **SL / TP Evaluation on Subsequent Candles**:
   - Stop Loss and Take Profit levels are evaluated on historical candles *subsequent* to entry ($t > t_{\text{entry}}$).
   - **LONG Position**:
     - $\text{Candle Low} \le \text{Stop Loss} \implies$ Stop Loss triggered at the SL price.
     - $\text{Candle High} \ge \text{Take Profit} \implies$ Take Profit triggered at the TP price.
   - **SHORT Position**:
     - $\text{Candle High} \ge \text{Stop Loss} \implies$ Stop Loss triggered at the SL price.
     - $\text{Candle Low} \le \text{Take Profit} \implies$ Take Profit triggered at the TP price.

3. **Intrabar Conflict Resolution (Both SL and TP touched in same candle)**:
   - When a single historical candle touches both SL and TP, OHLC data alone cannot determine intrabar price sequence.
   - We apply the **conservative trader assumption**: **Stop Loss is triggered first** (worst-case execution / risk-first assumption).

4. **P&L Formulas**:
   - $\text{LONG Gross P\&L} = (\text{Exit Price} - \text{Entry Price}) \times \text{Quantity} \times \text{Contract Size}$
   - $\text{SHORT Gross P\&L} = (\text{Entry Price} - \text{Exit Price}) \times \text{Quantity} \times \text{Contract Size}$
   - Contract size = 1 (1 unit = 1 troy ounce).
   - $\text{Equity} = \text{Balance} + \text{Unrealized P\&L}$.

5. **End-of-Dataset Behavior**:
   - If replay reaches the end of the dataset with an active position, the position remains open with unrealized P&L reported.
   - The position is never silently force-closed, and unrealized gains are never counted as realized profit.

---

## 3. Project Structure

```
AuTick/
├── app/
│   ├── api/market-data/route.ts  # Server-side Route Handler for market data
│   ├── globals.css               # Dark trading-terminal styles
│   ├── layout.tsx                # Terminal viewport and root layout
│   └── page.tsx                  # Main terminal workspace page
├── components/
│   ├── Chart.tsx                 # TradingView Lightweight Charts component
│   ├── DataSelectorModal.tsx     # Historical date range & provider picker
│   ├── Header.tsx                # Header bar with market clock & dataset stats
│   ├── ReplayToolbar.tsx         # Play/Pause, Step, Speed, Scrubber controls
│   ├── TradeHistory.tsx          # Session trade history ledger & metrics
│   └── TradePanel.tsx            # Order entry, SL/TP inputs & position card
├── lib/
│   ├── market-data/              # Data fetching, normalization & providers
│   │   ├── providers/            # Bybit & Twelve Data provider adapters
│   │   ├── validation.ts         # Candle validation & deduplication
│   │   └── types.ts              # Market data interfaces
│   ├── replay/                   # Pure TypeScript replay engine
│   │   └── replay-engine.ts      # ReplayEngine with virtual market clock
│   └── trading/                  # Pure TypeScript paper trading engine
│       ├── calculations.ts       # P&L and financial calculations
│       └── trading-engine.ts     # TradingEngine class
├── stores/
│   └── useTradingSimulatorStore.ts # Zustand in-memory orchestration
├── tests/
│   ├── market-data.test.ts       # Unit tests for data validation & providers
│   ├── replay.test.ts            # Unit tests for replay engine
│   └── trading.test.ts           # Unit tests for trading engine & SL/TP
├── types/                        # Core TypeScript domain types
└── .env.example                  # Environment configuration template
```

---

## 4. Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.1+) or Node.js

### Installation

```bash
# Install dependencies with Bun
bun install
```

### Environment Configuration (Optional)

AuTick works out-of-the-box using the public Bybit linear market data provider without any API key.

To use Twelve Data as an alternative provider:

```bash
cp .env.example .env.local
# Set your TWELVE_DATA_API_KEY in .env.local
```

### Running Locally

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Unit Tests

```bash
bun test
```

All 30 unit tests cover:
- Replay stepping, pausing, speed adjustment, dataset replacement, and future-data leakage prevention.
- LONG/SHORT P&L, manual closure, SL/TP triggers, conservative intrabar resolution, and duplicate tick prevention.
- Candle normalization, OHLC integrity, duplicate timestamps, date intervals, and provider error handling.

### Production Build

```bash
bun run build
bun run start
```
