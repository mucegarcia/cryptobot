// cron.js — Main entry point
// Run with: node cron.js
// Deploys to: Railway / Render / any Node.js host

require("dotenv").config();
const cron = require("node-cron");

const { getCoinData } = require("./src/binance");
const { getSignal } = require("./src/signals");
const { loadState, processTick, getTotalValue } = require("./src/portfolio");
const { sendTradeAlert, sendDailySummary, isConfigured } = require("./src/telegram");

// ── Config from .env ───────────────────────────────────────────────
const STARTING_CAPITAL = parseFloat(process.env.STARTING_CAPITAL || "500");
const STOP_LOSS_PCT = parseFloat(process.env.STOP_LOSS_PCT || "5");
const TAKE_PROFIT_PCT = parseFloat(process.env.TAKE_PROFIT_PCT || "10");
const POSITION_SIZE = parseFloat(process.env.POSITION_SIZE || "0.25");
const COINS = (process.env.COINS || "BTCUSDT,ETHUSDT,SOLUSDT,DOGEUSDT").split(",").map((s) => s.trim());
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "0 */4 * * *";

// ── Core tick function ─────────────────────────────────────────────
async function runTick() {
  const startTime = Date.now();
  console.log(`\n${"─".repeat(50)}`);
  console.log(`[${new Date().toISOString()}] Running bot tick...`);

  // 1. Load portfolio state
  const state = loadState(STARTING_CAPITAL);

  // 2. Fetch market data for all coins
  console.log(`[Data] Fetching prices for: ${COINS.join(", ")}`);
  let coinDataList;
  try {
    coinDataList = await Promise.all(
      COINS.map(async (symbol) => {
        const data = await getCoinData(symbol);
        const signal = getSignal(data.prices, data.change24h);
        return { ...data, signal };
      })
    );
  } catch (err) {
    console.error("[Data] Failed to fetch market data:", err.message);
    return;
  }

  // 3. Log signals
  console.log("\n[Signals]");
  for (const coin of coinDataList) {
    const { symbol, price, change24h, signal } = coin;
    const changeStr = change24h >= 0 ? `+${change24h.toFixed(2)}` : change24h.toFixed(2);
    console.log(`  ${symbol.padEnd(10)} $${price.toFixed(4).padStart(12)}  24h: ${changeStr.padStart(7)}%  → ${signal.label}`);
    for (const reason of signal.reasons) {
      console.log(`             · ${reason}`);
    }
  }

  // 4. Process trades
  const currentPrices = Object.fromEntries(coinDataList.map((c) => [c.symbol, c.price]));
  const executedTrades = processTick(state, coinDataList, {
    stopLossPct: STOP_LOSS_PCT,
    takeProfitPct: TAKE_PROFIT_PCT,
    positionSize: POSITION_SIZE,
  });

  // 5. Log executed trades
  if (executedTrades.length > 0) {
    console.log("\n[Trades Executed]");
    for (const trade of executedTrades) {
      const pnl = trade.pnlPct !== undefined ? ` (${trade.pnlPct >= 0 ? "+" : ""}${trade.pnlPct.toFixed(2)}%)` : "";
      console.log(`  ${trade.action.padEnd(12)} ${trade.symbol}  @ $${trade.price.toFixed(4)}${pnl}`);
    }
  } else {
    console.log("\n[Trades] No trades executed this tick");
  }

  // 6. Portfolio summary
  const reloadedState = loadState(STARTING_CAPITAL); // reload after processTick saved it
  const totalValue = getTotalValue(reloadedState, currentPrices);
  const pnlTotal = totalValue - STARTING_CAPITAL;
  const pnlPct = ((pnlTotal / STARTING_CAPITAL) * 100).toFixed(2);
  console.log(`\n[Portfolio] Total: $${totalValue.toFixed(2)} | P&L: ${pnlTotal >= 0 ? "+" : ""}${pnlPct}% | Cash: $${reloadedState.cash.toFixed(2)}`);

  const holdingsList = Object.entries(reloadedState.holdings);
  if (holdingsList.length > 0) {
    for (const [sym, h] of holdingsList) {
      const currentPrice = currentPrices[sym] || h.buyPrice;
      const pnl = ((currentPrice - h.buyPrice) / h.buyPrice * 100).toFixed(2);
      console.log(`  Holding ${sym}: qty=${h.qty.toFixed(6)} buyPrice=$${h.buyPrice.toFixed(4)} currentPnl=${pnl >= 0 ? "+" : ""}${pnl}%`);
    }
  }

  // 7. Send Telegram alerts for executed trades
  for (const trade of executedTrades) {
    await sendTradeAlert(trade, totalValue, STARTING_CAPITAL);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[Done] Tick completed in ${elapsed}s`);
}

// ── Daily summary (runs at 8am every day) ─────────────────────────
async function runDailySummary() {
  if (!isConfigured()) return;
  const state = loadState(STARTING_CAPITAL);
  try {
    const coinDataList = await Promise.all(
      COINS.map(async (symbol) => {
        const data = await getCoinData(symbol);
        const signal = getSignal(data.prices, data.change24h);
        return { ...data, signal };
      })
    );
    const currentPrices = Object.fromEntries(coinDataList.map((c) => [c.symbol, c.price]));
    const totalValue = getTotalValue(state, currentPrices);
    await sendDailySummary(state, totalValue, coinDataList);
  } catch (err) {
    console.error("[Summary] Failed:", err.message);
  }
}

// ── Startup ────────────────────────────────────────────────────────
console.log("╔══════════════════════════════════════════╗");
console.log("║         CRYPTOBOT — Starting up          ║");
console.log("╚══════════════════════════════════════════╝");
console.log(`  Coins:        ${COINS.join(", ")}`);
console.log(`  Stop-loss:    ${STOP_LOSS_PCT}%`);
console.log(`  Take-profit:  ${TAKE_PROFIT_PCT}%`);
console.log(`  Position:     ${POSITION_SIZE * 100}% of cash per trade`);
console.log(`  Schedule:     ${CRON_SCHEDULE}`);
console.log(`  Capital:      $${STARTING_CAPITAL}`);
console.log(`  Telegram:     ${isConfigured() ? "✓ configured" : "✗ not configured (alerts disabled)"}`);
console.log("");

// Run immediately on startup
runTick();

// Then run on schedule
cron.schedule(CRON_SCHEDULE, runTick);

// Daily summary at 8am
cron.schedule("0 8 * * *", runDailySummary);

console.log(`[Cron] Bot scheduled. Next tick at: ${CRON_SCHEDULE}`);
