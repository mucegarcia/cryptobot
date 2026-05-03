# CryptoBot — 24/7 Paper Trading Bot

Fetches real Binance prices every 4 hours, generates BUY/SELL/HOLD signals,
paper trades automatically, and sends Telegram alerts when trades fire.

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/cryptobot
cd cryptobot
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Set up Telegram Alerts (5 min)

1. Open Telegram → search for **@BotFather**
2. Send `/newbot` and follow the steps → copy your **token**
3. Start a chat with your new bot (click the link BotFather gives you)
4. Visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
5. Copy the `"id"` number from the `"chat"` object → that's your **Chat ID**
6. Paste both into `.env`

### 4. Run locally (test)

```bash
node cron.js
```

You'll see signals and trades logged. If Telegram is configured, you'll get a message.

---

## Deploy to Railway (recommended — $5/mo)

1. Push code to GitHub:
```bash
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/cryptobot.git
git push -u origin main
```

2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Go to **Variables** tab → add all your `.env` values
5. Railway auto-detects Node.js and runs `npm start` — done ✓

The bot will run 24/7 and restart automatically if it crashes.

---

## Deploy to Render (free tier available)

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `node cron.js`
4. Add environment variables in the dashboard
5. Deploy ✓

Note: Free tier spins down after inactivity. Use the $7/mo paid tier
to guarantee it stays alive 24/7.

---

## Project Structure

```
cryptobot/
├── cron.js              ← Main entry point (runs on schedule)
├── .env.example         ← Config template (copy to .env)
├── package.json
├── data/
│   └── portfolio.json   ← Auto-created — your portfolio state
└── src/
    ├── binance.js       ← Fetches real prices from Binance public API
    ├── signals.js       ← RSI + Moving Average signal engine
    ├── portfolio.js     ← Manages positions, stop-loss, take-profit
    └── telegram.js      ← Sends trade alerts to your phone
```

---

## How Signals Work

| Condition              | Score |
|------------------------|-------|
| RSI < 35 (oversold)    | +2    |
| RSI > 65 (overbought)  | -2    |
| MA7 > MA21 (uptrend)   | +1    |
| MA7 < MA21 (downtrend) | -1    |
| 24h drop > 3%          | +1    |
| 24h pump > 3%          | -1    |

- **Score ≥ +2** → BUY (invest 25% of cash)
- **Score ≤ -2** → SELL (exit position)
- **Otherwise** → HOLD

---

## Going Live (real trades)

> ⚠️ Only do this after paper trading profitably for 2+ months.

1. Create a Binance account and generate API keys
2. Add to `.env`:
   ```
   BINANCE_API_KEY=your_key
   BINANCE_SECRET=your_secret
   ```
3. The live trading module (`src/live.js`) will be used automatically
   when keys are present. Start with very small amounts ($20-50).

---

## Tips

- **Don't over-optimize** — if a strategy only works in backtesting, it won't in live trading
- **Watch it for a week** before trusting it with real money
- **BTC and ETH only** to start — most liquid, lowest risk of going to zero
- **4-hour intervals** are a good balance — not too reactive, not too slow
