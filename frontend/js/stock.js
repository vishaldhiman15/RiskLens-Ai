// ============ STOCK DEEP-DIVE JS ============
requireAuth();

let currentTicker = '';
let priceChart = null;
let isInWatchlist = false;

// Get ticker from URL
const urlParams = new URLSearchParams(window.location.search);
currentTicker = (urlParams.get('ticker') || '').toUpperCase();

if (!currentTicker) {
  window.location.href = '/dashboard.html';
}

document.title = `${currentTicker} — StockSage`;

// Load everything
loadStockData();
loadHistory('1y');
checkWatchlist();

// ---- Load Stock Quote ----
async function loadStockData() {
  try {
    const quote = await apiGet(`/api/stocks/summary/${currentTicker}`);
    
    document.getElementById('stock-ticker').textContent = currentTicker;
    document.getElementById('stock-name').textContent = quote.shortName || quote.longName || currentTicker;
    document.getElementById('stock-price').textContent = formatCurrency(quote.regularMarketPrice);
    
    const change = quote.regularMarketChangePercent || 0;
    const changeEl = document.getElementById('stock-change');
    changeEl.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
    changeEl.textContent = `${change >= 0 ? '▲' : '▼'} ${formatCurrency(Math.abs(quote.regularMarketChange || 0))} (${formatPercent(change)})`;

    // Previous close for chart baseline
    window.currentPreviousClose = quote.regularMarketPrice - (quote.regularMarketChange || 0);

    const statsGrid = document.getElementById('stock-stats-grid');
    const stats = [
      ['Open', formatCurrency(quote.regularMarketPrice - (quote.regularMarketChange || 0))], // Approx open
      ['Mkt cap', formatLargeNumber(quote.marketCap)],
      ['High', formatCurrency(quote.fiftyTwoWeekHigh)], // Using 52w for now as proxy or daily if available
      ['P/E ratio', quote.trailingPE ? quote.trailingPE.toFixed(2) : 'N/A'],
      ['Low', formatCurrency(quote.fiftyTwoWeekLow)],
      ['52-wk high', formatCurrency(quote.fiftyTwoWeekHigh)],
      ['Volume', formatLargeNumber(quote.regularMarketVolume)],
      ['52-wk low', formatCurrency(quote.fiftyTwoWeekLow)],
      ['Avg volume', formatLargeNumber(quote.averageDailyVolume3Month)],
      ['Dividend', 'N/A'], // Add more if API provides
    ];

    statsGrid.innerHTML = stats.map(([label, val]) => `
      <div class="stats-item">
        <span class="stats-label">${label}</span>
        <span class="stats-value">${val}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Stock data error:', err);
    document.getElementById('stock-name').textContent = 'Failed to load stock data';
  }
}

// ---- Load Price History & Chart ----
async function loadHistory(period, btnEl) {
  // Update active button
  if (btnEl) {
    document.querySelectorAll('#chart-periods button').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }

  try {
    const data = await apiGet(`/api/stocks/history/${currentTicker}?period=${period}`);
    renderChart(data.data, period);
  } catch (err) {
    console.error('History error:', err);
    showToast('Failed to load price history', 'error');
  }
}

function renderChart(history, period) {
  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }

  const candleData = history.map(h => {
    if (h.open !== null && h.high !== null && h.low !== null) {
      return {
        x: new Date(h.date),
        y: [h.open, h.high, h.low, h.close]
      };
    } else {
      return {
        x: new Date(h.date),
        y: [h.close, h.close, h.close, h.close]
      };
    }
  });

  const options = {
    series: [{
      name: 'Price',
      data: candleData
    }],
    chart: {
      type: 'candlestick',
      height: 350,
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: false }
    },
    theme: { mode: 'dark' },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#10b981',
          downward: '#ef4444'
        },
        wick: {
          useFillColor: true
        }
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: { colors: '#64748b', fontFamily: 'Inter' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      opposite: true,
      tooltip: { enabled: true },
      labels: {
        style: { colors: '#64748b', fontFamily: 'Inter' },
        formatter: (val) => { return "$" + val.toFixed(2); }
      }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.05)',
      strokeDashArray: 4,
    },
    tooltip: {
      theme: 'dark'
    }
  };

  const chartElement = document.querySelector("#price-chart");
  chartElement.innerHTML = '';
  priceChart = new ApexCharts(chartElement, options);
  priceChart.render();
}

function calculateSMA(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

// ---- AI Analysis ----
async function runAnalysis() {
  const loading = document.getElementById('analysis-loading');
  const section = document.getElementById('analysis-section');
  const btn = document.getElementById('analyze-btn');

  loading.style.display = 'flex';
  btn.disabled = true;
  btn.textContent = '🧠 Analyzing...';

  try {
    const analysis = await apiGet(`/api/analysis/${currentTicker}`);
    displayAnalysis(analysis);
    section.style.display = 'block';
    showToast('Analysis complete!', 'success');
  } catch (err) {
    console.error('Analysis error:', err);
    showToast('Analysis failed: ' + err.message, 'error');
  }

  loading.style.display = 'none';
  btn.disabled = false;
  btn.textContent = '🧠 Run AI Analysis';
}

function displayAnalysis(analysis) {
  // Score gauge
  const score = analysis.score || 0;
  const circle = document.getElementById('score-circle');
  const circumference = 2 * Math.PI * 75;
  const offset = circumference - (score / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  let scoreColor = '#f59e0b';
  if (score >= 60) scoreColor = '#10b981';
  else if (score <= 35) scoreColor = '#ef4444';
  circle.style.stroke = scoreColor;

  document.getElementById('score-number').textContent = score;
  document.getElementById('score-number').style.color = scoreColor;

  // Signal badge
  const signalBadge = document.getElementById('analysis-signal');
  signalBadge.textContent = analysis.signal || 'HOLD';
  signalBadge.className = `signal-badge ${getSignalClass(analysis.signal)}`;

  // Also update header badge
  const headerBadge = document.getElementById('stock-signal-badge');
  headerBadge.textContent = analysis.signal || 'HOLD';
  headerBadge.className = `signal-badge ${getSignalClass(analysis.signal)}`;

  // Confidence
  document.getElementById('analysis-confidence').textContent = `Confidence: ${analysis.confidence || 0}%`;

  // Forecast
  const fc = analysis.forecast || {};
  document.getElementById('forecast-price').textContent = formatCurrency(fc.predictedPrice);
  document.getElementById('forecast-range').textContent = `Range: ${formatCurrency(fc.priceRangeLow)} — ${formatCurrency(fc.priceRangeHigh)}`;
  
  const trendBadge = document.getElementById('forecast-trend');
  const trendDir = (fc.trendDirection || 'NEUTRAL').toUpperCase();
  trendBadge.textContent = `${trendDir} (${fc.trendPercentage >= 0 ? '+' : ''}${fc.trendPercentage || 0}%)`;
  trendBadge.className = `signal-badge ${trendDir === 'BULLISH' ? 'buy' : trendDir === 'BEARISH' ? 'wait' : 'hold'}`;
  
  document.getElementById('forecast-method').textContent = `Method: ${fc.method || 'AI Engine'}`;

  // Indicators
  const ind = analysis.indicators || {};
  const indList = document.getElementById('indicator-list');
  const indicators = [
    ['RSI (14)', ind.rsi],
    ['SMA 50', ind.sma50 ? formatCurrency(ind.sma50) : 'N/A'],
    ['SMA 200', ind.sma200 ? formatCurrency(ind.sma200) : 'N/A'],
    ['EMA 20', ind.ema20 ? formatCurrency(ind.ema20) : 'N/A'],
    ['MACD', ind.macd],
    ['MACD Signal', ind.macdSignal],
    ['Bollinger Upper', ind.bollingerUpper ? formatCurrency(ind.bollingerUpper) : 'N/A'],
    ['Bollinger Lower', ind.bollingerLower ? formatCurrency(ind.bollingerLower) : 'N/A'],
    ['ATR', ind.atr],
    ['Stochastic %K', ind.stochasticK],
    ['Volume Trend', ind.volumeTrend || 'N/A'],
    ['3M Momentum', ind.momentum3m != null ? formatPercent(ind.momentum3m) : 'N/A'],
    ['6M Momentum', ind.momentum6m != null ? formatPercent(ind.momentum6m) : 'N/A'],
  ];

  indList.innerHTML = indicators.map(([label, val]) => `
    <div class="indicator-item">
      <span class="ind-label">${label}</span>
      <span class="ind-value">${val}</span>
    </div>
  `).join('');

  // Reasons
  const reasonsList = document.getElementById('reasons-list');
  reasonsList.innerHTML = (analysis.reasons || []).map(r => `
    <div class="reason-item">${r}</div>
  `).join('');

  // Summary
  document.getElementById('analysis-summary').textContent = analysis.summary || 'No summary available.';
}

// ---- Watchlist toggle ----
async function checkWatchlist() {
  try {
    const data = await apiGet('/api/watchlist');
    isInWatchlist = (data.watchlist || []).includes(currentTicker);
    updateWatchlistBtn();
  } catch (e) { }
}

function updateWatchlistBtn() {
  const btn = document.getElementById('watchlist-btn');
  if (isInWatchlist) {
    btn.textContent = '★ In Watchlist';
    btn.className = 'btn btn-secondary';
  } else {
    btn.textContent = '☆ Add to Watchlist';
    btn.className = 'btn btn-green';
  }
}

async function toggleWatchlist() {
  try {
    if (isInWatchlist) {
      await apiDelete(`/api/watchlist/${currentTicker}`);
      isInWatchlist = false;
      showToast(`${currentTicker} removed from watchlist`, 'info');
    } else {
      await apiPost('/api/watchlist', { ticker: currentTicker });
      isInWatchlist = true;
      showToast(`${currentTicker} added to watchlist!`, 'success');
    }
    updateWatchlistBtn();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Helpers ----
function formatLargeNumber(num) {
  if (num == null || isNaN(num)) return 'N/A';
  if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
  return '$' + num.toLocaleString();
}
