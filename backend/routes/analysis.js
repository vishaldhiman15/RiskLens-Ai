const express = require('express');
const router = express.Router();
const axios = require('axios');
const Analysis = require('../models/Analysis');
const auth = require('../middleware/auth');
const { getYFSummary } = require('../utils/serpapi');
require('dotenv').config({ path: __dirname + '/../.env' });

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://127.0.0.1:5001';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: Specific routes MUST be declared before the generic /:ticker route
// otherwise Express will match /history/AAPL as ticker="history/AAPL"
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/analysis/history/:ticker  — past analyses for a ticker
router.get('/history/:ticker', auth, async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const analyses = await Analysis.find({ ticker }).sort({ createdAt: -1 }).limit(20);
    res.json(analyses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analysis history' });
  }
});

// GET /api/analysis/latest/:ticker  — most recent analysis (no auth needed for display)
router.get('/latest/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const analysis = await Analysis.findOne({ ticker }).sort({ createdAt: -1 });
    if (!analysis) return res.status(404).json({ error: 'No analysis found' });
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analysis/:ticker  — Run full AI analysis
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:ticker', auth, async (req, res) => {
  let ticker = req.params.ticker.toUpperCase();
  if (ticker.includes(':')) ticker = ticker.split(':')[0];

  // ── 1. Try Python AI engine ───────────────────────────────────────────────
  try {
    const aiResponse = await axios.get(`${PYTHON_AI_URL}/analyze/${ticker}`, {
      timeout: 90000 // 90s — Prophet can take time on first run
    });
    const aiResult = aiResponse.data;

    if (aiResult.error) {
      throw new Error(aiResult.error);
    }

    const analysis = new Analysis({
      ticker,
      userId: req.user.id,
      score: aiResult.score,
      signal: aiResult.signal,
      confidence: aiResult.confidence,
      summary: aiResult.summary,
      indicators: aiResult.indicators,
      forecast: aiResult.forecast,
      reasons: aiResult.reasons
    });

    await analysis.save();
    return res.json(analysis);

  } catch (aiError) {
    console.warn(`⚠️  Python AI unavailable for ${ticker}: ${aiError.message}`);
    console.log('🔄 Falling back to Yahoo Finance + rule-based analysis...');
  }

  // ── 2. Yahoo Finance fallback analysis ────────────────────────────────────
  try {
    const quote = await getYFSummary(ticker);

    if (!quote || !quote.regularMarketPrice) {
      return res.status(503).json({
        error: `Could not fetch data for ${ticker}. Verify the ticker symbol is correct.`
      });
    }

    // Simple rule-based signal from price movement
    const changePct = quote.regularMarketChangePercent || 0;
    const price = quote.regularMarketPrice;
    const high52 = quote.fiftyTwoWeekHigh || price;
    const low52  = quote.fiftyTwoWeekLow  || price;

    // Position in 52-week range (0 = at low, 1 = at high)
    const rangePosition = high52 !== low52 ? (price - low52) / (high52 - low52) : 0.5;

    let score = 50;
    const reasons = [];

    if (changePct > 2)       { score += 10; reasons.push(`📈 Up ${changePct.toFixed(2)}% today — strong momentum`); }
    else if (changePct > 0)  { score +=  5; reasons.push(`📈 Up ${changePct.toFixed(2)}% today`); }
    else if (changePct < -2) { score -= 10; reasons.push(`📉 Down ${Math.abs(changePct).toFixed(2)}% today — weak session`); }
    else if (changePct < 0)  { score -=  5; reasons.push(`📉 Down ${Math.abs(changePct).toFixed(2)}% today`); }

    if (rangePosition < 0.2) { score += 12; reasons.push(`📈 Near 52-week low — potential value zone`); }
    else if (rangePosition > 0.85) { score -= 8; reasons.push(`📉 Near 52-week high — limited upside`); }

    score = Math.max(0, Math.min(100, score));

    let signal = 'HOLD';
    if (score >= 65) signal = 'BUY';
    else if (score >= 55) signal = 'HOLD';
    else if (score >= 35) signal = 'WAIT';
    else signal = 'SELL';

    const confidence = 35; // Lower confidence — basic fallback

    // Simple price forecast (±15% range based on 52-week data)
    const predictedPrice = Math.round(price * (1 + changePct / 100 * 30) * 100) / 100;
    const priceLow  = Math.round(low52  * 1.02 * 100) / 100;
    const priceHigh = Math.round(high52 * 0.98 * 100) / 100;

    reasons.push(`ℹ️  Full AI analysis unavailable — Python engine is offline`);
    reasons.push(`💡 Start the Python AI service for deep technical analysis`);

    const fallbackAnalysis = new Analysis({
      ticker,
      userId: req.user.id,
      score,
      signal,
      confidence,
      summary: `Yahoo Finance Fallback: ${quote.shortName} is trading at $${price.toFixed(2)}, ${changePct >= 0 ? 'up' : 'down'} ${Math.abs(changePct).toFixed(2)}% today. Signal: ${signal}. Note: the Python AI engine was unavailable — start it for full technical analysis with RSI, MACD, Bollinger Bands and Prophet forecast.`,
      indicators: {
        currentPrice: price,
        fiftyTwoWeekHigh: high52,
        fiftyTwoWeekLow: low52,
        volumeTrend: quote.regularMarketVolume > 0 ? 'NORMAL' : 'N/A'
      },
      forecast: {
        predictedPrice,
        priceRangeLow:  priceLow,
        priceRangeHigh: priceHigh,
        horizon: '4-5 months (estimate)',
        trendDirection: changePct >= 0 ? 'BULLISH' : 'BEARISH',
        trendPercentage: Math.round(changePct * 30 * 100) / 100
      },
      reasons
    });

    await fallbackAnalysis.save();
    return res.json(fallbackAnalysis);

  } catch (fallbackError) {
    console.error('❌ Fallback analysis also failed:', fallbackError.message);
    return res.status(500).json({
      error: 'AI analysis failed. Both the Python engine and Yahoo Finance fallback are unavailable.',
      detail: fallbackError.message
    });
  }
});

module.exports = router;
