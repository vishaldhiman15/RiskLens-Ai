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
  const canvas = document.getElementById('price-chart');
  const ctx = canvas.getContext('2d');

  if (priceChart) priceChart.destroy();

  const labels = history.map(h => new Date(h.date));
  const prices = history.map(h => h.close);

  // Determine trend color
  const isPositive = prices.length > 1 && prices[prices.length - 1] >= prices[0];
  const themeColor = isPositive ? '#10b981' : '#ef4444';
  const themeGlow = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  // Gradient fill (subtle Google look)
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, themeGlow);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  const datasets = [
    {
      label: 'Price',
      data: prices,
      borderColor: themeColor,
      backgroundColor: gradient,
      fill: true,
      borderWidth: 1.8,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: themeColor,
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
      pointHitRadius: 20,
      tension: 0.4, // Smoother line
    }
  ];

  // Add Previous Close baseline if it exists (Google Finance style)
  if (window.currentPreviousClose) {
    const baselineData = new Array(prices.length).fill(window.currentPreviousClose);
    datasets.push({
      label: 'Previous Close',
      data: baselineData,
      borderColor: 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1,
      borderDash: [5, 5],
      pointRadius: 0,
      fill: false,
      order: 2
    });
  }

  priceChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false }, // Cleaner look
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: (ctx) => `Price: $${ctx.raw.toLocaleString(undefined, {minimumFractionDigits: 2})}`
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          grid: { display: false },
          ticks: {
            color: '#64748b',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7,
            font: { family: 'Inter', size: 10 }
          }
        },
        y: {
          position: 'right', // Google Finance style
          grace: '10%', // Add breathing room so spikes don't hit the ceiling
          grid: {
            color: 'rgba(255, 255, 255, 0.03)',
            drawBorder: false
          },
          ticks: {
            color: '#64748b',
            font: { family: 'Inter', size: 10 },
            callback: val => '$' + val.toLocaleString()
          }
        }
      }
    }
  });
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
