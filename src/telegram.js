// src/telegram.js
// Sends formatted trade alerts to your Telegram chat

const axios = require("axios");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function isConfigured() {
  return TOKEN && CHAT_ID && TOKEN !== "your_telegram_bot_token_here";
}

async function send(message) {
  if (!isConfigured()) {
    console.log("[Telegram] Not configured — skipping alert");
    console.log("[Telegram] Message would have been:", message);
    return;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "HTML",
      },
      { timeout: 8000 }
    );
    console.log("[Telegram] Alert sent ✓");
  } catch (err) {
    console.error("[Telegram] Failed to send alert:", err.message);
  }
}

function formatPrice(n) {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(5)}`;
}

function formatEmoji(action) {
  if (action === "BUY") return "🟢";
  if (action === "SELL") return "🔴";
  if (action === "STOP-LOSS") return "🛑";
  if (action === "TAKE-PROFIT") return "✅";
  return "⚪";
}

/**
 * Send a trade alert
 */
async function sendTradeAlert(trade, portfolioValue, startingCapital) {
  const emoji = formatEmoji(trade.action);
  const coin = trade.symbol.replace("USDT", "");
  const pnl = trade.pnlPct !== undefined
    ? `\n📊 P&L: <b>${trade.pnlPct >= 0 ? "+" : ""}${trade.pnlPct.toFixed(2)}%</b>`
    : "";
  const proceeds = trade.proceeds
    ? `\n💵 Proceeds: ${formatPrice(trade.proceeds)}`
    : `\n💵 Invested: ${formatPrice(trade.invested)}`;

  const totalPnlPct = ((portfolioValue - startingCapital) / startingCapital * 100).toFixed(2);
  const totalPnlSign = totalPnlPct >= 0 ? "+" : "";

  const msg = `${emoji} <b>${trade.action} ${coin}</b>
💰 Price: ${formatPrice(trade.price)}${proceeds}${pnl}

📈 Portfolio: ${formatPrice(portfolioValue)} (${totalPnlSign}${totalPnlPct}% total)
🕐 ${new Date(trade.time).toLocaleString()}`;

  await send(msg);
}

/**
 * Send a daily summary (optional, called separately)
 */
async function sendDailySummary(state, portfolioValue, coinDataList) {
  const pnlTotal = portfolioValue - state.startingCapital;
  const pnlPct = ((pnlTotal / state.startingCapital) * 100).toFixed(2);
  const sign = pnlTotal >= 0 ? "+" : "";

  const holdings = Object.entries(state.holdings)
    .map(([sym, h]) => {
      const coin = coinDataList.find((c) => c.symbol === sym);
      const currentPrice = coin?.price || h.buyPrice;
      const pnl = ((currentPrice - h.buyPrice) / h.buyPrice * 100).toFixed(1);
      return `  • ${sym.replace("USDT", "")}: ${pnl >= 0 ? "+" : ""}${pnl}%`;
    })
    .join("\n");

  const signals = coinDataList
    .map((c) => {
      const label = c.signal.label;
      const icon = label === "BUY" ? "🟢" : label === "SELL" ? "🔴" : "🟡";
      return `  ${icon} ${c.symbol.replace("USDT", "")}: ${label} (${formatPrice(c.price)})`;
    })
    .join("\n");

  const msg = `📋 <b>CryptoBot Daily Summary</b>

💼 Portfolio: ${formatPrice(portfolioValue)}
${sign}${pnlPct}% since start

${holdings ? `📦 Holdings:\n${holdings}\n` : "📦 No open positions\n"}
📡 Current Signals:
${signals}

💵 Cash available: ${formatPrice(state.cash)}`;

  await send(msg);
}

module.exports = { send, sendTradeAlert, sendDailySummary, isConfigured };
