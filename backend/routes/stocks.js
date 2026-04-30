const express = require('express');
const router = express.Router();
const axios = require('axios');

require('dotenv').config({ path: __dirname + '/../.env' });

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:5001';

const {
  getMarkets,
  getStockQuote,
  getMarketIndices,
  getYFSummary,
  getYFHistory
} = require('../utils/serpapi');

// ─── GET /api/stocks/markets/:trend? ─────────────────────────────────────────
router.get('/markets/:trend?', async (req, res) => {
  try {
    const trend = req.params.trend || 'most-active';
    const data = await getMarkets(trend);
    if (!data || !data.market_trends?.[0]?.results?.length) {
      return res.status(503).json({ error: 'Market data unavailable' });
    }
    res.json(data);
  } catch (error) {
    console.error('Markets error:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// ─── GET /api/stocks/indices ──────────────────────────────────────────────────
router.get('/indices', async (req, res) => {
  try {
    const data = await getMarketIndices();
    if (!data) return res.status(503).json({ error: 'Index data unavailable' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch indices' });
  }
});

// ─── GET /api/stocks/quote/:ticker ───────────────────────────────────────────
router.get('/quote/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const data = await getStockQuote(ticker);
    if (!data) return res.status(404).json({ error: 'Ticker not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quote' });
  }
});

// ─── GET /api/stocks/search ───────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    // Try Python AI first
    try {
      const response = await axios.get(`${PYTHON_AI_URL}/search`, { params: { q: query }, timeout: 3000 });
      return res.json(response.data);
    } catch (_) {}

    // Fallback: Yahoo Finance search
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=US&quotesCount=10&enableFuzzyQuery=false`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000
    });
    const quotes = (response.data?.quotes || []).map(q => ({
      symbol: q.symbol,
      shortname: q.shortname || q.longname || q.symbol,
      longname: q.longname || q.shortname || q.symbol,
      exchange: q.exchDisp || q.exchange || '',
      exchDisp: q.exchDisp || ''
    }));
    res.json({ quotes });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed', quotes: [] });
  }
});

// ─── GET /api/stocks/history/:ticker ─────────────────────────────────────────
router.get('/history/:ticker', async (req, res) => {
  try {
    let ticker = req.params.ticker.toUpperCase();
    if (ticker.includes(':')) ticker = ticker.split(':')[0];
    const period = req.query.period || '1y';

    // Try Python AI first
    try {
      const response = await axios.get(`${PYTHON_AI_URL}/history/${ticker}`, { params: { period }, timeout: 5000 });
      return res.json(response.data);
    } catch (_) {
      console.log('Python AI history unavailable, falling back to Yahoo Finance...');
    }

    // Yahoo Finance fallback
    const result = await getYFHistory(ticker, period);
    if (!result || !result.data?.length) {
      return res.status(404).json({ error: 'No history found for ' + ticker });
    }
    return res.json(result);
  } catch (error) {
    console.error('History error:', error.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ─── GET /api/stocks/summary/:ticker ─────────────────────────────────────────
router.get('/summary/:ticker', async (req, res) => {
  try {
    let ticker = req.params.ticker.toUpperCase();
    if (ticker.includes(':')) ticker = ticker.split(':')[0];

    // Try Python AI first
    try {
      const response = await axios.get(`${PYTHON_AI_URL}/quote/${ticker}`, { timeout: 3000 });
      return res.json(response.data);
    } catch (_) {
      console.log('Python AI summary unavailable, falling back to Yahoo Finance...');
    }

    // Yahoo Finance fallback
    const quote = await getYFSummary(ticker);
    if (!quote) {
      return res.status(404).json({ error: 'Summary not found for ' + ticker });
    }

    return res.json({
      shortName: quote.shortName,
      longName: quote.longName,
      regularMarketPrice: quote.regularMarketPrice,
      regularMarketChange: quote.regularMarketChange,
      regularMarketChangePercent: quote.regularMarketChangePercent,
      marketCap: 0, // not in chart API
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      trailingPE: null,
      regularMarketVolume: quote.regularMarketVolume,
      averageDailyVolume3Month: quote.regularMarketVolume
    });
  } catch (error) {
    console.error('Summary error:', error.message);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;
