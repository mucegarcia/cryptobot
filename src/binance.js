// src/binance.js
// Fetches real price data from Binance public API (no API key needed)

const axios = require("axios");

const BASE = "https://api.binance.com/api/v3";

/**
 * Fetch daily closing prices for a symbol over the last N days
 * Uses Binance's public klines endpoint — no auth required
 */
async function getDailyPrices(symbol, days = 30) {
  const res = await axios.get(`${BASE}/klines`, {
    params: {
      symbol,          // e.g. "BTCUSDT"
      interval: "1d",  // daily candles
      limit: days + 1, // +1 so we have enough for RSI calculation
    },
    timeout: 10000,
  });

  // Each kline: [openTime, open, high, low, close, volume, ...]
  // We only need the closing price (index 4)
  return res.data.map((k) => parseFloat(k[4]));
}

/**
 * Fetch the current price for a symbol
 */
async function getCurrentPrice(symbol) {
  const res = await axios.get(`${BASE}/ticker/price`, {
    params: { symbol },
    timeout: 5000,
  });
  return parseFloat(res.data.price);
}

/**
 * Fetch 24h price change % for a symbol
 */
async function get24hChange(symbol) {
  const res = await axios.get(`${BASE}/ticker/24hr`, {
    params: { symbol },
    timeout: 5000,
  });
  return parseFloat(res.data.priceChangePercent);
}

/**
 * Fetch all data needed for signals in one call per coin
 */
async function getCoinData(symbol) {
  const [prices, change24h] = await Promise.all([
    getDailyPrices(symbol, 30),
    get24hChange(symbol),
  ]);

  return {
    symbol,
    price: prices[prices.length - 1], // latest close
    change24h,
    prices, // 30-day history for indicators
  };
}

module.exports = { getCoinData, getCurrentPrice };
