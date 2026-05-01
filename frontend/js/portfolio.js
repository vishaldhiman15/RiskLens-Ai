// ============ PORTFOLIO LOGIC ============

let portfolio = [];
let allocationChart = null;

// Mock current prices for simulation
const MOCK_PRICES = {
  'AAPL': 185.92,
  'GOOGL': 142.71,
  'MSFT': 397.58,
  'TSLA': 193.57,
  'NVDA': 726.13,
  'BTC': 52140.00,
  'ETH': 2850.00
};

// Initial mock data if empty
const INITIAL_DATA = [
  { symbol: 'AAPL', quantity: 10, avgPrice: 175.50 },
  { symbol: 'MSFT', quantity: 5, avgPrice: 350.00 },
  { symbol: 'BTC', quantity: 0.1, avgPrice: 45000.00 }
];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  
  loadPortfolio();
  initChart();
  renderPortfolio();
  
  // Form submission
  document.getElementById('add-asset-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleAddAsset();
  });
});

function loadPortfolio() {
  const saved = localStorage.getItem('rl_portfolio');
  if (saved) {
    portfolio = JSON.parse(saved);
  } else {
    portfolio = INITIAL_DATA;
    savePortfolio();
  }
}

function savePortfolio() {
  localStorage.setItem('rl_portfolio', JSON.stringify(portfolio));
}

function renderPortfolio() {
  const tbody = document.getElementById('portfolio-tbody');
  const emptyState = document.getElementById('empty-portfolio');
  
  tbody.innerHTML = '';
  
  if (portfolio.length === 0) {
    emptyState.style.display = 'block';
    updateStats(0, 0, 0);
    updateChart([]);
    return;
  }
  
  emptyState.style.display = 'none';
  
  let totalBalance = 0;
  let totalInvested = 0;
  
  portfolio.forEach((asset, index) => {
    const currentPrice = MOCK_PRICES[asset.symbol.toUpperCase()] || asset.avgPrice * 1.05; // Default 5% gain if price unknown
    const marketValue = asset.quantity * currentPrice;
    const costBasis = asset.quantity * asset.avgPrice;
    const pl = marketValue - costBasis;
    const plPercent = (pl / costBasis) * 100;
    
    totalBalance += marketValue;
    totalInvested += costBasis;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="asset-info">
          <div class="asset-symbol">${asset.symbol.toUpperCase()}</div>
        </div>
      </td>
      <td>${asset.quantity}</td>
      <td>${formatCurrency(asset.avgPrice)}</td>
      <td>${formatCurrency(currentPrice)}</td>
      <td class="${pl >= 0 ? 'positive' : 'negative'}" style="font-weight: 600;">
        ${formatCurrency(pl)} (${formatPercent(plPercent)})
      </td>
      <td>
        <button class="btn btn-sm" onclick="removeAsset(${index})" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);">Remove</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  const totalPL = totalBalance - totalInvested;
  const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
  
  updateStats(totalBalance, totalPL, totalInvested);
  updateChart(portfolio.map(a => ({ 
    symbol: a.symbol, 
    value: a.quantity * (MOCK_PRICES[a.symbol.toUpperCase()] || a.avgPrice * 1.05) 
  })));
}

function updateStats(balance, pl, invested) {
  document.getElementById('total-balance').textContent = formatCurrency(balance);
  document.getElementById('total-pl').textContent = formatCurrency(pl);
  document.getElementById('invested-capital').textContent = formatCurrency(invested);
  
  const plEl = document.getElementById('pl-percentage');
  const plPercent = invested > 0 ? (pl / invested) * 100 : 0;
  plEl.textContent = formatPercent(plPercent);
  plEl.className = `stat-change ${pl >= 0 ? 'positive' : 'negative'}`;
  
  // Total change (simulated)
  const totalChangeEl = document.getElementById('total-change');
  const dayChange = (Math.random() * 2 - 0.5).toFixed(2);
  totalChangeEl.textContent = `${dayChange >= 0 ? '+' : ''}${dayChange}% (Today)`;
  totalChangeEl.className = `stat-change ${dayChange >= 0 ? 'positive' : 'negative'}`;
}

function handleAddAsset() {
  const symbol = document.getElementById('asset-symbol').value.toUpperCase();
  const quantity = parseFloat(document.getElementById('asset-quantity').value);
  const avgPrice = parseFloat(document.getElementById('asset-price').value);
  
  if (!symbol || isNaN(quantity) || isNaN(avgPrice)) {
    showToast('Please fill all fields correctly', 'error');
    return;
  }
  
  portfolio.push({ symbol, quantity, avgPrice });
  savePortfolio();
  renderPortfolio();
  closeModal();
  showToast(`${symbol} added to portfolio`, 'success');
  
  // Reset form
  document.getElementById('add-asset-form').reset();
}

function removeAsset(index) {
  const asset = portfolio[index];
  portfolio.splice(index, 1);
  savePortfolio();
  renderPortfolio();
  showToast(`${asset.symbol} removed`, 'info');
}

function initChart() {
  const ctx = document.getElementById('allocation-chart').getContext('2d');
  allocationChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: [
          '#6d4aff', '#34d399', '#fbbf24', '#ef4444', '#3b82f6', '#8b5cf6'
        ],
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${formatCurrency(context.raw)}`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

function updateChart(data) {
  if (!allocationChart) return;
  
  allocationChart.data.labels = data.map(d => d.symbol);
  allocationChart.data.datasets[0].data = data.map(d => d.value);
  allocationChart.update();
}

// Modal functions
function openModal() {
  document.getElementById('add-asset-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('add-asset-modal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('add-asset-modal');
  if (event.target == modal) {
    closeModal();
  }
}
