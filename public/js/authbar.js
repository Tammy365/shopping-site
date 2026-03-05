// public/js/authbar.js

function escapeHTML(s = '') {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

async function refreshAuthBar() {
  try {
    const res = await fetch('/api/me');
    const me  = await res.json();
    const bar = document.getElementById('authbar');
    if (!bar) return;

    if (me.loggedIn) {
      // ✅ 使用真正的 <a> 标签（管理员多一个 Admin 按钮）
      bar.innerHTML =
        `Hello, ${escapeHTML(me.email)}${me.admin ? ' (admin)' : ''} · ` +
        (me.admin ? `<a href="/admin">Admin</a> · ` : ``) +
        `<a href="/change-password.html">Change Password</a> · ` +
        `<a href="#" id="logout-link">Logout</a>`;

      // 绑定注销
      const logout = document.getElementById('logout-link');
      if (logout) {
        logout.addEventListener('click', async (e) => {
          e.preventDefault();
          await fetch('/api/logout', { method: 'POST' });
          location.reload();
        });
      }
    } else {
      bar.innerHTML = `<a href="/login.html">Login</a> · <a href="/register.html">Register</a>`;
    }
  } catch {
    const bar = document.getElementById('authbar');
    if (bar) bar.innerHTML = `<a href="/login.html">Login</a> · <a href="/register.html">Register</a>`;
  }
}

document.addEventListener('DOMContentLoaded', refreshAuthBar);