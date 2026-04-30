requireAuth();
const user = getUser();
if (!user || user.role !== 'admin') {
    window.location.href = '/dashboard.html';
}

async function loadAdminData() {
    try {
        const stats = await apiGet('/api/admin/stats');
        const users = await apiGet('/api/admin/users');
        
        document.getElementById('admin-stats').innerHTML = `
            <div class="glass-card">
              <h3 style="font-size:24px; font-weight:800; color:var(--accent-green)">${stats.totalUsers}</h3>
              <p class="text-muted">Total Users</p>
            </div>
            <div class="glass-card">
              <h3 style="font-size:24px; font-weight:800; color:var(--accent-blue)">${stats.recentSignups}</h3>
              <p class="text-muted">Recent Signups (7d)</p>
            </div>
        `;
        
        const tbody = document.getElementById('user-table-body');
        tbody.innerHTML = users.map(u => `
            <tr>
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td><span class="signal-badge ${u.role === 'admin' ? 'buy' : 'hold'}">${u.role.toUpperCase()}</span></td>
              <td>${formatDate(u.createdAt)}</td>
              <td>
                <button class="btn btn-red btn-sm" onclick="deleteUser('${u._id}')" ${u._id === user.id ? 'disabled title="Cannot delete self"' : ''}>Delete</button>
              </td>
            </tr>
        `).join('');
    } catch (e) {
        showToast('Failed to load admin data', 'error');
    }
}

async function deleteUser(id) {
    if (!confirm('Are you certain you want to delete this user? This cannot be undone.')) return;
    try {
        await apiDelete('/api/admin/users/' + id);
        showToast('User deleted successfully', 'success');
        loadAdminData();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', loadAdminData);
