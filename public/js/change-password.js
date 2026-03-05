// public/js/change-password.js
(function(){
  // Logout
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async ()=>{
      try { await fetch('/api/logout', { method: 'POST' }); }
      finally { location.href = '/login.html'; }
    });
  }

  // Change password
  const form = document.getElementById('cp-form');
  const msg  = document.getElementById('msg');
  if (!form) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();               // 防止 ?current=&password=... 的 GET 提交
    if (msg) msg.textContent = '';

    const fd = new FormData(form);
    if (fd.get('password') !== fd.get('password2')) {
      if (msg) msg.textContent = 'Passwords do not match';
      return;
    }

    try{
      const res  = await fetch('/api/change-password', { method:'POST', body: fd });
      const json = await res.json();

      if (json && json.success) {
        alert('Password changed. Please log in again.');
        location.href = '/login.html';
      } else {
        if (msg) msg.textContent = (json && json.error) || 'Failed to change password';
      }
    }catch(err){
      if (msg) msg.textContent = 'Network error';
    }
  });
})();