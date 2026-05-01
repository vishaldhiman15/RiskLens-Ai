// ============ STARTUP DETAIL JS ============
requireAuth();

const urlParams = new URLSearchParams(window.location.search);
const startupId = urlParams.get('id');

if (!startupId) {
  window.location.href = '/dashboard.html';
}

async function loadStartupData() {
  try {
    const startup = await apiGet(`/api/startups/${startupId}`);
    
    document.title = `${startup.name} — RiskLens-AI`;
    document.getElementById('startup-title').textContent = startup.name || 'Unknown Startup';
    document.getElementById('startup-industry').textContent = `Industry: ${startup.industry || 'N/A'}`;
    
    document.getElementById('startup-description').textContent = startup.description || 'No description provided by the founder.';
    document.getElementById('startup-stage').textContent = startup.stage || 'N/A';
    
    // In a real app, funding goals and valuation could be calculated or entered separately.
    document.getElementById('startup-funding').textContent = startup.publicMetrics?.fundingGoal ? `$${startup.publicMetrics.fundingGoal.toLocaleString()}` : 'TBD';
    document.getElementById('startup-valuation').textContent = startup.publicMetrics?.valuation ? `$${startup.publicMetrics.valuation.toLocaleString()}` : 'TBD';

  } catch (error) {
    console.error('Error loading startup details:', error);
    showToast('Failed to load startup data.', 'error');
    document.getElementById('startup-title').textContent = 'Error Loading Startup';
  }
}

async function investInStartup() {
  const startupName = document.getElementById('startup-title').textContent;
  const amountStr = prompt(`Enter investment amount (USD) for ${startupName}:`);
  if (!amountStr) return;
  
  const amount = Number(amountStr);
  if (isNaN(amount) || amount <= 0) {
    alert("Invalid amount");
    return;
  }
  
  try {
    await apiPost('/api/auth/investments', { companyName: startupName, amount });
    showToast(`Successfully logged investment of $${amount} in ${startupName}!`);
  } catch (err) {
    showToast('Failed to log investment: ' + err.message, 'error');
  }
}

// Search functionality
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

if(searchInput) {
    searchInput.addEventListener('input', (e) => doSearch(e.target.value.trim()));
    searchInput.addEventListener('focus', (e) => { if (e.target.value.trim()) doSearch(e.target.value.trim()); });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    if(searchResults) searchResults.classList.remove('active');
  }
});

loadStartupData();
