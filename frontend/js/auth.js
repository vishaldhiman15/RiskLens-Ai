// ============ AUTH JS ============

// Signup
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('signup-error');
    const btn = document.getElementById('signup-btn');
    
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Creating Account...';

    const formData = new FormData();
    formData.append('name', document.getElementById('signup-name').value.trim());
    formData.append('email', document.getElementById('signup-email').value.trim());
    formData.append('password', document.getElementById('signup-password').value);
    
    // New role and conditional fields
    const selectedRole = document.querySelector('input[name="role"]:checked')?.value;
    if (selectedRole) formData.append('role', selectedRole);

    if (selectedRole === 'founder') {
      const startupName = document.getElementById('startup-name').value.trim();
      if (startupName) formData.append('startupName', startupName);
    } else if (selectedRole === 'investor') {
      const investmentBudget = document.getElementById('investment-budget').value;
      if (investmentBudget) formData.append('investmentBudget', investmentBudget);
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('stocksage_token', data.token);
        localStorage.setItem('stocksage_user', JSON.stringify(data.user));
        window.location.href = '/dashboard.html';
      } else {
        errorEl.textContent = data.error || 'Signup failed';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = 'Network error. Is the server running?';
      errorEl.style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Sign Up';
  });
}

// Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    
    errorEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing In...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: document.getElementById('login-email').value.trim(),
          password: document.getElementById('login-password').value
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('stocksage_token', data.token);
        localStorage.setItem('stocksage_user', JSON.stringify(data.user));
        window.location.href = '/dashboard.html';
      } else {
        errorEl.textContent = data.error || 'Login failed';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = 'Network error. Is the server running?';
      errorEl.style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Sign In';
  });
}
