// ============ WATCHLIST JS ============
requireAuth();

loadWatchlist();
loadPortfolio();

// ---- Watchlist ----
async function loadWatchlist() {
  const tbody = document.getElementById('watchlist-tbody');
  
  try {
    const data = await apiGet('/api/watchlist');
    const tickers = data.watchlist || [];
    
    if (tickers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:40px;">
        <div style="font-size:48px;">📋</div>
        <p class="text-muted mt-1">No stocks in your watchlist. Go to Dashboard to add some!</p>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    
    for (const ticker of tickers) {
      const row = document.createElement('tr');
      row.style.cursor = 'pointer';
      row.innerHTML = `<td><strong>${ticker}</strong></td><td colspan="5" style="text-align:center;"><div class="loading-spinner" style="width:20px;height:20px;border-width:2px;"></div></td><td></td>`;
      tbody.appendChild(row);

      // Fetch quote data
      fetchWatchlistRow(ticker, row);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px;">Failed to load watchlist</td></tr>`;
  }
}

async function fetchWatchlistRow(ticker, row) {
  try {
    const quote = await apiGet(`/api/stocks/summary/${ticker}`);
    const change = quote.regularMarketChangePercent || 0;
    
    // Try to get latest signal
    let signal = '--';
    let signalClass = 'hold';
    try {
      const analysis = await apiGet(`/api/analysis/latest/${ticker}`);
      signal = analysis.signal || '--';
      signalClass = getSignalClass(signal);
    } catch (e) { }

    row.innerHTML = `
      <td onclick="window.location.href='/stock.html?ticker=${ticker}'"><strong>${ticker}</strong><br><span class="text-muted text-sm">${quote.shortName || ''}</span></td>
      <td onclick="window.location.href='/stock.html?ticker=${ticker}'">${formatCurrency(quote.regularMarketPrice)}</td>
      <td onclick="window.location.href='/stock.html?ticker=${ticker}'"><span class="change ${change >= 0 ? 'positive' : 'negative'}">${change >= 0 ? '▲' : '▼'} ${formatPercent(change)}</span></td>
      <td onclick="window.location.href='/stock.html?ticker=${ticker}'">${formatCurrency(quote.fiftyTwoWeekHigh)}</td>
      <td onclick="window.location.href='/stock.html?ticker=${ticker}'">${formatCurrency(quote.fiftyTwoWeekLow)}</td>
      <td onclick="window.location.href='/stock.html?ticker=${ticker}'"><span class="signal-badge ${signalClass}">${signal}</span></td>
      <td><button class="btn btn-red btn-sm" onclick="event.stopPropagation(); removeFromWatchlist('${ticker}')">✕</button></td>
    `;
  } catch (e) {
    row.innerHTML = `
      <td><strong>${ticker}</strong></td>
      <td colspan="5" class="text-muted">Data unavailable</td>
      <td><button class="btn btn-red btn-sm" onclick="removeFromWatchlist('${ticker}')">✕</button></td>
    `;
  }
}

async function removeFromWatchlist(ticker) {
  try {
    await apiDelete(`/api/watchlist/${ticker}`);
    showToast(`${ticker} removed from watchlist`, 'info');
    loadWatchlist();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Portfolio ----
function showAddPortfolio() {
  document.getElementById('portfolio-modal').style.display = 'block';
}

function hideAddPortfolio() {
  document.getElementById('portfolio-modal').style.display = 'none';
}

document.getElementById('portfolio-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const ticker = document.getElementById('port-ticker').value.trim();
  const shares = document.getElementById('port-shares').value;
  const buyPrice = document.getElementById('port-price').value;

  try {
    await apiPost('/api/watchlist/portfolio', { ticker, shares, buyPrice });
    showToast(`${ticker.toUpperCase()} position added!`, 'success');
    hideAddPortfolio();
    document.getElementById('portfolio-form').reset();
    loadPortfolio();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

async function loadPortfolio() {
  const tbody = document.getElementById('portfolio-tbody');
  
  try {
    const data = await apiGet('/api/watchlist/portfolio');
    const positions = data.portfolio || [];
    
    if (positions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px;">
        <div style="font-size:48px;">💼</div>
        <p class="text-muted mt-1">No positions yet. Add your first trade above.</p>
      </td></tr>`;
      document.getElementById('portfolio-summary').style.display = 'none';
      return;
    }

    tbody.innerHTML = '';
    let totalPnL = 0;

    for (const pos of positions) {
      const row = document.createElement('tr');
      row.innerHTML = `<td><strong>${pos.ticker}</strong></td><td>${pos.shares}</td><td>${formatCurrency(pos.buyPrice)}</td><td colspan="3"><div class="loading-spinner" style="width:16px;height:16px;border-width:2px;"></div></td><td></td>`;
      tbody.appendChild(row);

      // Fetch current price
      try {
        const quote = await apiGet(`/api/stocks/summary/${pos.ticker}`);
        const currentPrice = quote.regularMarketPrice || 0;
        const pnl = (currentPrice - pos.buyPrice) * pos.shares;
        const pnlPct = ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100;
        totalPnL += pnl;

        row.innerHTML = `
          <td onclick="window.location.href='/stock.html?ticker=${pos.ticker}'" style="cursor:pointer"><strong>${pos.ticker}</strong></td>
          <td>${pos.shares}</td>
          <td>${formatCurrency(pos.buyPrice)}</td>
          <td>${formatCurrency(currentPrice)}</td>
          <td class="${pnl >= 0 ? 'text-green' : 'text-red'}" style="font-weight:700;">${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}</td>
          <td><span class="change ${pnlPct >= 0 ? 'positive' : 'negative'}">${formatPercent(pnlPct)}</span></td>
          <td><button class="btn btn-red btn-sm" onclick="removePosition('${pos._id}')">✕</button></td>
        `;
      } catch (e) {
        row.innerHTML = `
          <td><strong>${pos.ticker}</strong></td>
          <td>${pos.shares}</td>
          <td>${formatCurrency(pos.buyPrice)}</td>
          <td colspan="3" class="text-muted">Price unavailable</td>
          <td><button class="btn btn-red btn-sm" onclick="removePosition('${pos._id}')">✕</button></td>
        `;
      }
    }

    // Summary
    const summaryEl = document.getElementById('portfolio-summary');
    const totalEl = document.getElementById('total-pnl');
    summaryEl.style.display = 'block';
    totalEl.textContent = `${totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL)}`;
    totalEl.style.color = totalPnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:40px;">Failed to load portfolio</td></tr>`;
  }
}

async function removePosition(id) {
  try {
    await apiDelete(`/api/watchlist/portfolio/${id}`);
    showToast('Position removed', 'info');
    loadPortfolio();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
