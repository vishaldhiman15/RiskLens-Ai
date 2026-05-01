// ============ FOUNDER HUB JS ============
requireAuth();

const currentUser = getUser();
if (!currentUser || currentUser.role !== 'founder') {
  // Redirect non-founders away
  window.location.href = '/dashboard.html';
}

// Set avatar initials
const navAvatar = document.getElementById('nav-avatar');
const navInitials = document.getElementById('nav-initials');
if (navInitials && currentUser?.name) {
  navInitials.textContent = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── State ───────────────────────────────────────────────
let growthChartObj = null;
let reachChartObj  = null;
let analyticsData  = null;

// ─── Load on boot ────────────────────────────────────────
loadAnalytics();
loadNotifications();

// ─── API ─────────────────────────────────────────────────
async function loadAnalytics() {
  try {
    const data = await apiGet('/api/startups/mine/analytics');
    analyticsData = data;

    // ── Org profile strip ──
    const s = data.startup;
    document.getElementById('op-name').textContent  = s.name || 'Your Startup';
    document.getElementById('op-desc').textContent  = s.description || 'No description set.';
    document.getElementById('op-since').textContent = s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—';

    const tagsEl = document.getElementById('op-tags');
    tagsEl.innerHTML = '';
    if (s.industry) tagsEl.innerHTML += `<span class="org-tag">${s.industry}</span>`;
    if (s.stage)    tagsEl.innerHTML += `<span class="org-tag">${s.stage}</span>`;

    // Update page title
    document.title = `${s.name} Hub — RiskLens-AI`;

    // ── KPI stats ──
    document.getElementById('kpi-raised').textContent      = formatCurrency(data.totalRaised || 0);
    document.getElementById('kpi-investors').textContent   = `${data.investorCount} investor${data.investorCount !== 1 ? 's' : ''}`;
    document.getElementById('kpi-mrr').textContent         = formatCurrency(s.confidentialMetrics?.monthlyRecurringRevenue || 0);
    document.getElementById('kpi-burn').textContent        = formatCurrency(s.confidentialMetrics?.burnRate || 0);
    document.getElementById('kpi-platform-inv').textContent = data.platformStats?.totalInvestorCount ?? '—';
    document.getElementById('kpi-platform-total').textContent = `of ${data.platformStats?.totalUsers ?? '—'} total users`;

    // ── Investor table ──
    renderInvestorTable(data.investors || []);

    // ── Pre-fill edit modal ──
    document.getElementById('ef-name').value     = s.name || '';
    document.getElementById('ef-industry').value = s.industry || '';
    document.getElementById('ef-stage').value    = s.stage || '';
    document.getElementById('ef-desc').value     = s.description || '';
    document.getElementById('ef-mrr').value      = s.confidentialMetrics?.monthlyRecurringRevenue || '';
    document.getElementById('ef-burn').value     = s.confidentialMetrics?.burnRate || '';

    // ── Charts ──
    initGrowthChart();
    initReachChart(data.platformStats);

  } catch (err) {
    console.error('Failed to load analytics:', err);
    showToast('No startup profile found. Please set one up first.', 'error');
  }
}

// ─── Investor Table ───────────────────────────────────────
function renderInvestorTable(investors) {
  const badge = document.getElementById('inv-count-badge');
  badge.textContent = `${investors.length} investor${investors.length !== 1 ? 's' : ''}`;

  const wrap = document.getElementById('inv-table-wrap');
  if (!investors.length) {
    wrap.innerHTML = `<div class="fh-empty"><div class="fh-empty-icon">📭</div><p>No investors yet. Share your startup page to attract funding!</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="inv-table">
      <thead>
        <tr>
          <th>Investor</th>
          <th>Amount Invested</th>
          <th>Rounds</th>
          <th>Latest Investment</th>
        </tr>
      </thead>
      <tbody>
        ${investors.map(inv => {
          const initials = inv.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
          const dateStr  = inv.latestDate ? new Date(inv.latestDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';
          return `
            <tr>
              <td>
                <div class="inv-info">
                  <div class="inv-avatar">${initials}</div>
                  <div>
                    <div class="inv-name">${inv.name}</div>
                    <div class="inv-email">${inv.email}</div>
                  </div>
                </div>
              </td>
              <td><span class="pill-positive">${formatCurrency(inv.totalInvested)}</span></td>
              <td><span style="color:#94a3b8;">${inv.rounds} round${inv.rounds !== 1 ? 's' : ''}</span></td>
              <td style="color:#64748b;">${dateStr}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ─── Notifications ────────────────────────────────────────
async function loadNotifications() {
  const list = document.getElementById('notif-list');
  try {
    const data = await apiGet('/api/notifications');
    if (!data || !data.length) {
      list.innerHTML = `<div class="fh-empty"><div class="fh-empty-icon">📡</div><p>No announcements yet.</p></div>`;
      return;
    }
    list.innerHTML = data.map(n => `
      <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:14px 18px; border-left:3px solid var(--accent-amber);">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <strong style="color:#fbbf24; font-size:14px;">${n.startupName || 'Announcement'}</strong>
          <span style="font-size:12px; color:#475569;">${new Date(n.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>
        </div>
        <p style="font-size:14px; color:#e2e8f0; line-height:1.5;">${n.message}</p>
      </div>
    `).join('');
  } catch {
    list.innerHTML = `<div class="fh-empty"><p>Failed to load announcements.</p></div>`;
  }
}

// ─── Push Update ──────────────────────────────────────────
async function sendPush() {
  const msg = document.getElementById('push-msg').value.trim();
  if (!msg) return showToast('Message cannot be empty', 'error');

  try {
    await apiPost('/api/notifications', { message: msg });
    document.getElementById('push-msg').value = '';
    document.getElementById('push-char').textContent = '0/400';
    closeModal('push-modal');
    showToast('Update pushed to all investors! 🚀');
    loadNotifications();
  } catch (err) {
    showToast('Failed to push update: ' + err.message, 'error');
  }
}

// ─── Edit Startup ─────────────────────────────────────────
document.getElementById('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name:        document.getElementById('ef-name').value,
    industry:    document.getElementById('ef-industry').value,
    stage:       document.getElementById('ef-stage').value,
    description: document.getElementById('ef-desc').value,
    confidentialMetrics: {
      monthlyRecurringRevenue: Number(document.getElementById('ef-mrr').value) || 0,
      burnRate:                Number(document.getElementById('ef-burn').value) || 0
    }
  };

  try {
    await apiPost('/api/startups', payload);
    closeModal('edit-modal');
    showToast('Startup profile updated! ✅');
    loadAnalytics();
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  }
});

// ─── Modal helpers ────────────────────────────────────────
function openEditModal() { document.getElementById('edit-modal').style.display = 'flex'; }
function openPushModal()  { document.getElementById('push-modal').style.display = 'flex'; }
function closeModal(id)   { document.getElementById(id).style.display = 'none'; }

// Close on backdrop click
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
});

// ─── Growth Chart ─────────────────────────────────────────
function initGrowthChart() {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('growth-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, 'rgba(245,158,11,0.35)');
  grad.addColorStop(1, 'rgba(245,158,11,0)');

  if (growthChartObj) growthChartObj.destroy();
  growthChartObj = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Active Users',
        data: [120, 190, 300, 500, 800, 1200],
        borderColor: '#f59e0b',
        backgroundColor: grad,
        fill: true, tension: 0.4, borderWidth: 2,
        pointBackgroundColor: '#fcd34d', pointRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } }
      }
    }
  });
}

function switchChart() {
  if (!growthChartObj) return;
  const type = document.getElementById('chart-type').value;
  const mrr = analyticsData?.startup?.confidentialMetrics?.monthlyRecurringRevenue || 31000;
  if (type === 'revenue') {
    growthChartObj.data.datasets[0].label = 'Revenue (MRR $)';
    growthChartObj.data.datasets[0].data  = [Math.round(mrr*.1), Math.round(mrr*.22), Math.round(mrr*.38), Math.round(mrr*.55), Math.round(mrr*.75), mrr];
  } else {
    growthChartObj.data.datasets[0].label = 'Active Users';
    growthChartObj.data.datasets[0].data  = [120, 190, 300, 500, 800, 1200];
  }
  growthChartObj.update();
}

// ─── Reach Doughnut ──────────────────────────────────────
function initReachChart(stats) {
  if (typeof Chart === 'undefined' || !stats) return;
  const canvas = document.getElementById('reach-chart');
  if (!canvas) return;
  if (reachChartObj) reachChartObj.destroy();
  reachChartObj = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Investors', 'Founders', 'Users'],
      datasets: [{
        data: [stats.totalInvestorCount || 1, stats.totalFounderCount || 1, Math.max(0, (stats.totalUsers || 2) - (stats.totalInvestorCount || 0) - (stats.totalFounderCount || 0))],
        backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(139,92,246,0.8)', 'rgba(59,130,246,0.8)'],
        borderColor: ['#10b981','#8b5cf6','#3b82f6'],
        borderWidth: 2, hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16, font: { size: 12 } } }
      }
    }
  });
}

// ─── Currency helper (local fallback) ────────────────────
if (typeof formatCurrency === 'undefined') {
  window.formatCurrency = (v) => '$' + Number(v).toLocaleString();
}
