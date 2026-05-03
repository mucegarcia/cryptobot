// src/portfolio.js
// Persists paper trading state to a JSON file so it survives restarts

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "../data/portfolio.json");

function ensureDataDir() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadState(startingCapital) {
  ensureDataDir();
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  }
  // First run — create fresh portfolio
  const initial = {
    cash: startingCapital,
    holdings: {},   // { "BTCUSDT": { qty, buyPrice, invested, boughtAt } }
    trades: [],     // trade history
    startingCapital,
    createdAt: new Date().toISOString(),
  };
  saveState(initial);
  return initial;
}

function saveState(state) {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Process signals and update portfolio state
 * Returns list of trades executed this tick
 */
function processTick(state, coinDataList, { stopLossPct, takeProfitPct, positionSize }) {
  const executed = [];
  const now = new Date().toISOString();

  for (const coin of coinDataList) {
    const { symbol, price, signal } = coin;
    const held = state.holdings[symbol];

    // ── Check stop-loss / take-profit for existing positions ──
    if (held) {
      const pnlPct = ((price - held.buyPrice) / held.buyPrice) * 100;

      if (pnlPct <= -stopLossPct) {
        const proceeds = held.qty * price;
        state.cash += proceeds;
        delete state.holdings[symbol];
        const trade = { time: now, symbol, action: "STOP-LOSS", price, pnlPct, proceeds };
        state.trades.push(trade);
        executed.push(trade);
        continue; // don't re-buy immediately after a stop-loss
      }

      if (pnlPct >= takeProfitPct) {
        const proceeds = held.qty * price;
        state.cash += proceeds;
        delete state.holdings[symbol];
        const trade = { time: now, symbol, action: "TAKE-PROFIT", price, pnlPct, proceeds };
        state.trades.push(trade);
        executed.push(trade);
        continue;
      }
    }

    // ── Execute BUY signal ──
    if (!state.holdings[symbol] && signal.label === "BUY" && state.cash >= 10) {
      const invest = Math.min(state.cash * positionSize, state.cash);
      const qty = invest / price;
      state.cash -= invest;
      state.holdings[symbol] = { qty, buyPrice: price, invested: invest, boughtAt: now };
      const trade = { time: now, symbol, action: "BUY", price, invested, qty };
      state.trades.push(trade);
      executed.push(trade);
    }

    // ── Execute SELL signal ──
    else if (state.holdings[symbol] && signal.label === "SELL") {
      const h = state.holdings[symbol];
      const proceeds = h.qty * price;
      const pnlPct = ((price - h.buyPrice) / h.buyPrice) * 100;
      state.cash += proceeds;
      delete state.holdings[symbol];
      const trade = { time: now, symbol, action: "SELL", price, pnlPct, proceeds };
      state.trades.push(trade);
      executed.push(trade);
    }
  }

  // Keep only last 200 trades in history to avoid bloat
  state.trades = state.trades.slice(-200);
  state.lastUpdated = now;

  saveState(state);
  return executed;
}

/**
 * Calculate total portfolio value given current prices
 */
function getTotalValue(state, currentPrices) {
  let holdingsValue = 0;
  for (const [symbol, held] of Object.entries(state.holdings)) {
    const price = currentPrices[symbol] || held.buyPrice;
    holdingsValue += held.qty * price;
  }
  return state.cash + holdingsValue;
}

module.exports = { loadState, saveState, processTick, getTotalValue };
