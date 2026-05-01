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

if (currentUser && currentUser.role === 'investor') {
  const navStartups = document.getElementById('nav-startups');
  if (navStartups) navStartups.style.display = 'flex';
  
  const startupsPanel = document.getElementById('startups-panel');
  if (startupsPanel) startupsPanel.style.display = 'block';

  const investmentsPanel = document.getElementById('investments-panel');
  if (investmentsPanel) investmentsPanel.style.display = 'block';
  
  loadStartups();
  loadInvestments();
}

if (currentUser && currentUser.role === 'founder') {
  // Show "My Organisation" in sidebar (common.js also handles this)
  const navFounder = document.getElementById('nav-founder');
  if (navFounder) navFounder.style.display = 'flex';

  // Show the teaser banner that links to founder.html
  const founderPanel = document.getElementById('founder-panel');
  if (founderPanel) founderPanel.style.display = 'block';
}


async function loadInvestments() {
  const grid = document.getElementById('investments-grid');
  if (!grid) return;
  try {
    const data = await apiGet('/api/auth/me');
    const investments = data.companyInvestments || [];
    if (investments.length === 0) {
      grid.innerHTML = '<div class="empty-state glass-card" style="grid-column:1/-1;"><p>No investments added yet.</p></div>';
      return;
    }
    grid.innerHTML = investments.map(inv => `
      <div class="glass-card" style="padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s;">
        <div>
          <div style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Investment</div>
          <div class="ticker" style="font-size: 1.4rem; font-weight: 800; color: #fff;">${inv.companyName}</div>
        </div>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 2px;">Amount</div>
            <div class="price" style="font-size: 1.2rem; color: #34d399; font-weight: 700;">${formatCurrency(inv.amount)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Date</div>
            <div style="font-size: 0.9rem; color: #e2e8f0;">${new Date(inv.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = '<div class="empty-state glass-card" style="grid-column:1/-1;"><p>Could not load investments.</p></div>';
  }
}

async function addInvestmentPrompt() {
  const companyName = prompt("Enter Startup/Company Name:");
  if (!companyName) return;
  const amountStr = prompt("Enter Investment Amount (USD):");
  if (!amountStr) return;
  const amount = Number(amountStr);
  if (isNaN(amount) || amount <= 0) {
    alert("Invalid amount");
    return;
  }
  try {
    await apiPost('/api/auth/investments', { companyName, amount });
    loadInvestments();
    showToast('Investment added successfully');
  } catch (err) {
    showToast('Failed to add investment: ' + err.message, 'error');
  }
}

// ---- Startups (for Investors) ----
let allStartups = [];

async function loadStartups() {
  const grid = document.getElementById('startups-grid');
  if (!grid) return;
  try {
    const data = await apiGet('/api/startups');
    allStartups = data || [];
    
    // Populate filter dropdowns
    const industries = [...new Set(allStartups.map(s => s.industry).filter(Boolean))];
    const stages = [...new Set(allStartups.map(s => s.stage).filter(Boolean))];
    
    const indFilter = document.getElementById('startup-industry-filter');
    const stageFilter = document.getElementById('startup-stage-filter');
    
    if (indFilter) {
      indFilter.innerHTML = '<option value="">All Industries</option>' + industries.map(i => `<option value="${i}">${i}</option>`).join('');
    }
    if (stageFilter) {
      stageFilter.innerHTML = '<option value="">All Stages</option>' + stages.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    
    renderStartups(allStartups);
  } catch (err) {
    grid.innerHTML = '<div class="empty-state glass-card" style="grid-column:1/-1;"><p>Could not load startups.</p></div>';
  }
}

function renderStartups(startupsToRender) {
  const grid = document.getElementById('startups-grid');
  if (!grid) return;
  if (!startupsToRender || startupsToRender.length === 0) {
    grid.innerHTML = '<div class="empty-state glass-card" style="grid-column:1/-1;"><p>No startups found matching your criteria.</p></div>';
    return;
  }
  
  grid.innerHTML = startupsToRender.map(startup => `
    <div class="glass-card startup-card" onclick="window.location.href='/startup.html?id=${startup._id}'" style="cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; height: 100%; transition: transform 0.2s, border-color 0.2s; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px;">
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div class="ticker" style="font-size: 1.3rem; font-weight: 800; color: #fff;">${startup.name || 'Unknown Startup'}</div>
          <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; border: 1px solid rgba(52, 211, 153, 0.3);">${startup.stage || 'N/A'}</span>
        </div>
        <div class="name" style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 15px;">${startup.description || 'No description provided.'}</div>
      </div>
      <div style="padding: 15px 20px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05); border-radius: 0 0 12px 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #94a3b8; font-size: 0.85rem; display: flex; align-items: center; gap: 5px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          ${startup.industry || 'N/A'}
        </span>
        <button class="btn btn-primary btn-sm" style="padding: 4px 12px; font-size: 0.8rem; background: linear-gradient(135deg, #6d4aff, #8b5cf6);">View Details →</button>
      </div>
    </div>
  `).join('');
}

function filterStartups() {
  const searchQuery = document.getElementById('startup-directory-search')?.value.toLowerCase() || '';
  const industryFilter = document.getElementById('startup-industry-filter')?.value || '';
  const stageFilter = document.getElementById('startup-stage-filter')?.value || '';
  
  const filtered = allStartups.filter(s => {
    const matchesSearch = !searchQuery || (s.name && s.name.toLowerCase().includes(searchQuery)) || (s.description && s.description.toLowerCase().includes(searchQuery));
    const matchesIndustry = !industryFilter || s.industry === industryFilter;
    const matchesStage = !stageFilter || s.stage === stageFilter;
    return matchesSearch && matchesIndustry && matchesStage;
  });
  
  renderStartups(filtered);
}

// Add event listeners for startup filtering
const startupSearchInput = document.getElementById('startup-directory-search');
const startupIndustryFilter = document.getElementById('startup-industry-filter');
const startupStageFilter = document.getElementById('startup-stage-filter');

if (startupSearchInput) startupSearchInput.addEventListener('input', debounce(filterStartups, 300));
if (startupIndustryFilter) startupIndustryFilter.addEventListener('change', filterStartups);
if (startupStageFilter) startupStageFilter.addEventListener('change', filterStartups);

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

    // Search Mongo startups
    let startupMatches = [];
    try {
        const startupsData = typeof allStartups !== 'undefined' && allStartups.length > 0 
          ? allStartups 
          : await apiGet('/api/startups');
          
        const lowerQ = query.toLowerCase();
        startupMatches = startupsData.filter(s => 
          (s.name && s.name.toLowerCase().includes(lowerQ)) || 
          (s.description && s.description.toLowerCase().includes(lowerQ))
        );
    } catch(e) {
      console.error("Failed to load startups for search", e);
    }

    const combinedHtml = [];
    
    startupMatches.slice(0, 3).forEach(s => {
      combinedHtml.push(`
        <div class="search-result-item" onclick="window.location.href='/startup.html?id=${s._id}'" style="border-left: 3px solid #10b981; background: rgba(16, 185, 129, 0.05);">
          <div>
            <div style="font-weight:700; color: #10b981; display: flex; align-items: center; gap: 6px;">${s.name} <span style="font-size: 0.6rem; background: rgba(16,185,129,0.2); color: #34d399; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.3); text-transform: uppercase; font-weight: 800;">STARTUP</span></div>
            <div class="text-muted text-sm" style="margin-top: 3px;">${s.industry || 'Private Company'}</div>
          </div>
          <div class="text-muted text-sm">${s.stage || ''}</div>
        </div>
      `);
    });

    results.slice(0, 8).forEach(r => {
      combinedHtml.push(`
        <div class="search-result-item" onclick="window.location.href='/stock.html?ticker=${encodeURIComponent(r.symbol)}'">
          <div>
            <div style="font-weight:700;">${r.symbol}</div>
            <div class="text-muted text-sm">${r.shortname || r.longname || ''}</div>
          </div>
          <div class="text-muted text-sm">${r.exchDisp || r.exchange || ''}</div>
        </div>
      `);
    });
    
    if (combinedHtml.length === 0) {
      searchResults.innerHTML = `<div class="search-result-item"><span class="text-muted">No results found</span></div>`;
      searchResults.classList.add('active');
      return;
    }

    searchResults.innerHTML = combinedHtml.join('');
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
