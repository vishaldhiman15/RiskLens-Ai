// ============ DASHBOARD JS ============
requireAuth();

// Set greeting and date
const greetingEl = document.getElementById('greeting');
const dateEl = document.getElementById('current-date');
const currentUser = getUser();
const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'User';
if (document.body.classList.contains('dashboard-neo') && greetingEl && dateEl) {
  greetingEl.textContent = `${getGreeting()}, ${firstName}`;
  dateEl.textContent = 'Here is the latest market overview';
} else {
  if (greetingEl) greetingEl.textContent = getGreeting();
  if (dateEl) dateEl.textContent = formatDate(new Date());
}

initDashboardCharts();

// Load market data on init
loadMarket('most-active');
loadQuickWatchlist();

// ---- Market Data ----
async function loadMarket(trend, btnEl) {
  // Update active tab
  if (btnEl) {
    document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
    btnEl.classList.add('active');
  }

  const grid = document.getElementById('market-grid');
  grid.innerHTML = `<div class="glass-card" style="text-align:center; padding:40px; grid-column:1/-1;"><div class="loading-spinner"></div><p class="loading-text mt-2">Loading ${trend}...</p></div>`;

  try {
    const data = await apiGet(`/api/stocks/markets/${trend}`);
    const stocks = data.market_trends?.[0]?.results || [];
    
    if (stocks.length === 0) {
      grid.innerHTML = `<div class="empty-state glass-card" style="grid-column:1/-1;"><p>No market data available. Check your SerpAPI key.</p></div>`;
      return;
    }

    grid.innerHTML = stocks.slice(0, 12).map(stock => `
      <div class="stock-card" onclick="window.location.href='/stock.html?ticker=${encodeURIComponent(stock.stock || stock.symbol || '')}'">
        <div class="ticker">${stock.stock || stock.symbol || '---'}</div>
        <div class="name">${stock.name || ''}</div>
        <div class="price">${stock.price || '$--'}</div>
        <div class="change ${(stock.price_movement?.percentage || 0) >= 0 ? 'positive' : 'negative'}">
          ${(stock.price_movement?.percentage || 0) >= 0 ? '▲' : '▼'} 
          ${stock.price_movement?.movement || ''} (${stock.price_movement?.percentage || 0}%)
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Market load error:', err);
    grid.innerHTML = `<div class="empty-state glass-card" style="grid-column:1/-1;">
      <div class="empty-icon">📊</div>
      <p>Could not load market data. Make sure SerpAPI key is configured.</p>
      <p class="text-sm text-muted mt-1">${err.message}</p>
    </div>`;
  }
}

// ---- Market Indices ----
async function loadIndices() {
  const container = document.getElementById('indices-container');
  try {
    const data = await apiGet('/api/stocks/indices');
    const indices = data.market_trends?.[0]?.results || [];
    
    if (indices.length === 0) {
      container.innerHTML = `<div class="glass-card text-center" style="grid-column:1/-1;"><p class="text-muted">Indices unavailable</p></div>`;
      return;
    }

    container.innerHTML = indices.slice(0, 6).map(idx => `
      <div class="glass-card" style="text-align:center; cursor:pointer;" onclick="window.location.href='/stock.html?ticker=${encodeURIComponent(idx.stock || idx.symbol || '')}'">
        <div class="text-muted text-sm">${idx.name || idx.stock || ''}</div>
        <div style="font-size:24px; font-weight:800; margin:8px 0;">${idx.price || '--'}</div>
        <div class="change ${(idx.price_movement?.percentage || 0) >= 0 ? 'positive' : 'negative'}" style="font-size:13px;">
          ${(idx.price_movement?.percentage || 0) >= 0 ? '▲' : '▼'} ${idx.price_movement?.percentage || 0}%
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="glass-card text-center" style="grid-column:1/-1;"><p class="text-muted">Could not load indices</p></div>`;
  }
}

// ---- Quick Watchlist ----
async function loadQuickWatchlist() {
  const container = document.getElementById('quick-watchlist');
  try {
    const data = await apiGet('/api/watchlist');
    const tickers = data.watchlist || [];
    
    if (tickers.length === 0) {
      container.innerHTML = `<div class="empty-state glass-card" style="grid-column:1/-1;">
        <div class="empty-icon">📋</div>
        <p>Your watchlist is empty. Search and add stocks!</p>
      </div>`;
      return;
    }

    container.innerHTML = '';
    for (const ticker of tickers.slice(0, 8)) {
      try {
        const quote = await apiGet(`/api/stocks/summary/${ticker}`);
        const card = document.createElement('div');
        card.className = 'stock-card';
        card.onclick = () => window.location.href = `/stock.html?ticker=${ticker}`;
        
        const change = quote.regularMarketChangePercent || 0;
        card.innerHTML = `
          <div class="ticker">${ticker}</div>
          <div class="name">${quote.shortName || quote.longName || ''}</div>
          <div class="price">${formatCurrency(quote.regularMarketPrice)}</div>
          <div class="change ${change >= 0 ? 'positive' : 'negative'}">
            ${change >= 0 ? '▲' : '▼'} ${formatPercent(change)}
          </div>
        `;
        container.appendChild(card);
      } catch (e) {
        const card = document.createElement('div');
        card.className = 'stock-card';
        card.innerHTML = `<div class="ticker">${ticker}</div><div class="text-muted">Data unavailable</div>`;
        container.appendChild(card);
      }
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state glass-card" style="grid-column:1/-1;"><p class="text-muted">Could not load watchlist</p></div>`;
  }
}

// ---- Search ----
const searchInput = document.getElementById('stock-search');
const searchResults = document.getElementById('search-results');

const doSearch = debounce(async (query) => {
  if (!query || query.length < 1) {
    searchResults.classList.remove('active');
    return;
  }

  try {
    const data = await apiGet(`/api/stocks/search?q=${encodeURIComponent(query)}`);
    const results = data.quotes || [];
    
    if (results.length === 0) {
      searchResults.innerHTML = `<div class="search-result-item"><span class="text-muted">No results found</span></div>`;
      searchResults.classList.add('active');
      return;
    }

    searchResults.innerHTML = results.slice(0, 8).map(r => `
      <div class="search-result-item" onclick="window.location.href='/stock.html?ticker=${encodeURIComponent(r.symbol)}'">
        <div>
          <div style="font-weight:700;">${r.symbol}</div>
          <div class="text-muted text-sm">${r.shortname || r.longname || ''}</div>
        </div>
        <div class="text-muted text-sm">${r.exchDisp || r.exchange || ''}</div>
      </div>
    `).join('');
    searchResults.classList.add('active');
  } catch (err) {
    searchResults.innerHTML = `<div class="search-result-item"><span class="text-muted">Search failed</span></div>`;
    searchResults.classList.add('active');
  }
}, 400);

searchInput.addEventListener('input', (e) => doSearch(e.target.value.trim()));
searchInput.addEventListener('focus', (e) => { if (e.target.value.trim()) doSearch(e.target.value.trim()); });
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) searchResults.classList.remove('active');
});

function initDashboardCharts() {
  if (typeof Chart === 'undefined') return;

  const profitCanvas = document.getElementById('profit-chart');
  if (profitCanvas) {
    const ctx = profitCanvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, profitCanvas.height || 180);
    gradient.addColorStop(0, 'rgba(125, 99, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(125, 99, 255, 0.02)');

    const labels = ['9:00', '10:00', '11:00', '12:00', '1:00', '2:00', '3:00', '4:00'];
    const values = [12.4, 13.1, 12.7, 13.8, 14.2, 13.6, 14.6, 15.1];

    const profitChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Profit',
            data: values,
            borderColor: '#8a73ff',
            backgroundColor: gradient,
            fill: true,
            tension: 0.45,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            pointBackgroundColor: '#e9e5ff',
            pointBorderColor: '#8a73ff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1f2240',
            borderColor: 'rgba(143, 146, 255, 0.4)',
            borderWidth: 1,
            titleColor: '#ffffff',
            bodyColor: '#d9ddff'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#9aa2c4',
              callback: (v) => '$' + v + 'K'
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#9aa2c4' }
          }
        }
      }
    });

    const tick = () => {
      const last = values[values.length - 1];
      const delta = (Math.random() - 0.35) * 0.9;
      const next = Math.max(8, +(last + delta).toFixed(1));
      values.push(next);
      labels.push(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      if (values.length > 10) {
        values.shift();
        labels.shift();
      }
      profitChart.update('none');
    };

    setInterval(tick, 12000);
  }
}
