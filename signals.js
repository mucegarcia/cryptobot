// src/signals.js
// Technical indicator calculations and signal generation

/**
 * Relative Strength Index (RSI)
 * < 35  → oversold  → bullish signal
 * > 65  → overbought → bearish signal
 * 35-65 → neutral
 */
function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Simple Moving Average
 */
function calcMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Generate a BUY / SELL / HOLD signal from indicators
 *
 * Scoring system:
 *   RSI oversold (<35)      → +2
 *   RSI overbought (>65)    → -2
 *   MA7 > MA21 (uptrend)    → +1
 *   MA7 < MA21 (downtrend)  → -1
 *   Big 24h dip (< -3%)     → +1  (buy the dip)
 *   Big 24h pump (> +3%)    → -1  (avoid chasing)
 *
 *   Total >= +2  → BUY
 *   Total <= -2  → SELL
 *   Otherwise   → HOLD
 */
function getSignal(prices, change24h) {
  const rsi = calcRSI(prices);
  const ma7 = calcMA(prices, 7);
  const ma21 = calcMA(prices, 21);

  let score = 0;
  const reasons = [];

  // RSI
  if (rsi !== null) {
    if (rsi < 35) {
      score += 2;
      reasons.push(`RSI oversold at ${rsi.toFixed(1)}`);
    } else if (rsi > 65) {
      score -= 2;
      reasons.push(`RSI overbought at ${rsi.toFixed(1)}`);
    } else {
      reasons.push(`RSI neutral at ${rsi.toFixed(1)}`);
    }
  }

  // Moving average crossover
  if (ma7 !== null && ma21 !== null) {
    if (ma7 > ma21) {
      score += 1;
      reasons.push(`MA7 (${ma7.toFixed(2)}) > MA21 (${ma21.toFixed(2)}) — uptrend`);
    } else {
      score -= 1;
      reasons.push(`MA7 (${ma7.toFixed(2)}) < MA21 (${ma21.toFixed(2)}) — downtrend`);
    }
  }

  // 24h momentum
  if (change24h < -3) {
    score += 1;
    reasons.push(`${change24h.toFixed(1)}% dip today — potential buy opportunity`);
  } else if (change24h > 3) {
    score -= 1;
    reasons.push(`+${change24h.toFixed(1)}% pump today — avoid chasing`);
  }

  let label;
  if (score >= 2) label = "BUY";
  else if (score <= -2) label = "SELL";
  else label = "HOLD";

  return { label, score, reasons, rsi, ma7, ma21 };
}

module.exports = { calcRSI, calcMA, getSignal };
