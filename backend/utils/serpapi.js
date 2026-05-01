const https = require('https');
require('dotenv').config({ path: __dirname + '/../.env' });

const SERPAPI_KEY = process.env.SERPAPI_KEY;

// ─── Yahoo Finance helpers ───────────────────────────────────────────────────

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9'
};

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: YF_HEADERS }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from: ' + url)); }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch a single stock's metadata via Yahoo Finance v8 chart API.
 * Returns a normalized object matching the format expected by the routes.
 */
async function fetchYFQuote(symbol) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const json = await httpsGet(url);
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || !meta.regularMarketPrice) return null;

  const prev = meta.chartPreviousClose || meta.regularMarketPrice;
  const price = meta.regularMarketPrice;
  const change = price - prev;
  const changePct = prev ? (change / prev) * 100 : 0;

  return {
    symbol: meta.symbol,
    shortName: meta.shortName || meta.symbol,
    longName: meta.longName || meta.shortName || meta.symbol,
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: changePct,
    regularMarketVolume: meta.regularMarketVolume || 0,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
    currency: meta.currency || 'USD',
    exchangeName: meta.fullExchangeName || meta.exchangeName || ''
  };
}

// ─── Market lists ─────────────────────────────────────────────────────────────

const MARKET_LISTS = {
  'most-active': ['AAPL','MSFT','NVDA','TSLA','AMZN','META','GOOGL','AMD','NFLX','INTC','BABA','PLTR','SOFI','F','BAC','T','NIO','RIVN','GME','UBER'],
  'gainers':     ['NVDA','TSLA','META','PLTR','SOFI','NIO','RIVN','GME','AMD','MARA','COIN','HOOD','RBLX','SNAP','LYFT','OPEN','WISH','CLOV','SPCE','WKHS'],
  'losers':      ['INTC','IBM','GE','F','T','VZ','XOM','CVX','C','WFC','BAC','JPM','WMT','TGT','COST','HD','LOW','DIS','CMCSA','NFLX'],
  'indexes':     ['^GSPC','^DJI','^IXIC','^RUT','^VIX','^TNX']
};

/**
 * Returns market data in the shape the frontend expects:
 * { market_trends: [{ results: [ { stock, name, price, price_movement: { percentage, movement } } ] }] }
 */
async function getMarkets(trend = 'most-active') {
  const symbols = MARKET_LISTS[trend] || MARKET_LISTS['most-active'];

  // Fetch all in parallel (cap at 12 to save SerpAPI credits)
  const quotes = await Promise.allSettled(symbols.slice(0, 12).map(s => fetchYFQuote(s)));

  const results = quotes
    .filter(q => q.status === 'fulfilled' && q.value)
    .map(q => {
      const d = q.value;
      const pct = +(d.regularMarketChangePercent || 0).toFixed(2);
      return {
        stock: d.symbol,
        name: d.shortName,
        price: `$${d.regularMarketPrice.toFixed(2)}`,
        price_movement: {
          percentage: Math.abs(pct),
          value: +Math.abs(d.regularMarketChange || 0).toFixed(2),
          movement: pct >= 0 ? 'Up' : 'Down'
        }
      };
    });

  return { market_trends: [{ results }] };
}

/**
 * Single stock quote — returns Yahoo Finance data.
 * Falls back to SerpAPI if Yahoo fails.
 */
async function getStockQuote(ticker) {
  try {
    const quote = await fetchYFQuote(ticker);
    if (quote) return { summary: { title: quote.shortName, extracted_price: quote.regularMarketPrice }, _yfQuote: quote };
  } catch (e) {
    console.warn('Yahoo quote failed for', ticker, '—', e.message);
  }

  // SerpAPI fallback
  if (SERPAPI_KEY) {
    try {
      const { getJson } = require('serpapi');
      return await getJson({ engine: 'google_finance', q: ticker, api_key: SERPAPI_KEY });
    } catch (e) {
      console.error('SerpAPI quote fallback failed:', e.message);
    }
  }
  return null;
}

/**
 * Market indices — same structure as getMarkets but for index symbols.
 */
async function getMarketIndices() {
  return getMarkets('indexes');
}

/**
 * Full quote for the /summary route — returns yfinance-shaped object.
 */
async function getYFSummary(ticker) {
  return fetchYFQuote(ticker);
}

/**
 * Historical data via Yahoo Finance v8.
 */
async function getYFHistory(ticker, period = '1y') {
  const rangeMap = { '1m': '1mo', '3m': '3mo', '6m': '6mo', '1y': '1y', '5y': '5y', 'max': 'max', '1d': '1d', '5d': '5d' };
  const range = rangeMap[period.toLowerCase()] || '1y';
  const intervalMap = { '1d': '1d', '5d': '5d', '1mo': '1wk', '3mo': '1wk', '6mo': '1d', '1y': '1d', '2y': '1wk', '5y': '1mo', 'max': '1mo' };
  const interval = intervalMap[range] || '1d';

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;
  const json = await httpsGet(url);
  const result = json?.chart?.result?.[0];
  if (!result) return null;

  const timestamps = result.timestamp || [];
  const opens = result.indicators?.quote?.[0]?.open || [];
  const highs = result.indicators?.quote?.[0]?.high || [];
  const lows = result.indicators?.quote?.[0]?.low || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const volumes = result.indicators?.quote?.[0]?.volume || [];

  const data = timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().split('T')[0],
    open: opens[i] || null,
    high: highs[i] || null,
    low: lows[i] || null,
    close: closes[i] || null,
    volume: volumes[i] || 0
  })).filter(d => d.close !== null);

  return { data };
}

module.exports = { getMarkets, getStockQuote, getMarketIndices, getYFSummary, getYFHistory };
