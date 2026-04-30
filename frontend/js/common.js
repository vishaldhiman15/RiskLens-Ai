// ============ COMMON UTILITIES ============
const API_BASE = '';

function getToken() {
  return localStorage.getItem('stocksage_token');
}

function getUser() {
  const u = localStorage.getItem('stocksage_user');
  return u ? JSON.parse(u) : null;
}

function setAuth(token, user) {
  localStorage.setItem('stocksage_token', token);
  localStorage.setItem('stocksage_user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('stocksage_token');
  localStorage.removeItem('stocksage_user');
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return false;
  }
  // Set nav initials
  const user = getUser();
  if (user && user.name) {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const el = document.getElementById('nav-initials');
    if (el) el.textContent = initials;
  }
  // Insert Admin Portal Link dynamically
  if (user && user.role === 'admin') {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks && !document.getElementById('admin-nav-link')) {
      const li = document.createElement('li');
      li.id = 'admin-nav-link';
      li.innerHTML = '<a href="/admin.html" style="color:var(--accent-amber)">Admin Portal</a>';
      navLinks.appendChild(li);
    }
  }

  return true;
}

function logout() {
  clearAuth();
  window.location.href = '/login.html';
}

async function apiGet(url) {
  const res = await fetch(API_BASE + url, {
    headers: {
      'Authorization': 'Bearer ' + getToken(),
      'Content-Type': 'application/json'
    }
  });
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(API_BASE + url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + getToken(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(API_BASE + url, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer ' + getToken(),
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.json();
}

// Toast notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Format currency
function formatCurrency(val) {
  if (val == null || isNaN(val)) return '$--';
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format percentage
function formatPercent(val) {
  if (val == null || isNaN(val)) return '--';
  const prefix = val >= 0 ? '+' : '';
  return prefix + Number(val).toFixed(2) + '%';
}

// Get signal badge class
function getSignalClass(signal) {
  if (!signal) return 'hold';
  const s = signal.toLowerCase().replace(' ', '-');
  if (s.includes('strong')) return 'strong-buy';
  if (s.includes('buy')) return 'buy';
  if (s.includes('hold')) return 'hold';
  if (s.includes('wait')) return 'wait';
  if (s.includes('sell')) return 'sell';
  return 'hold';
}

// Get greeting based on time
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning ☀️';
  if (hour < 17) return 'Good Afternoon 🌤️';
  return 'Good Evening 🌙';
}

// Format date
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// Debounce
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
