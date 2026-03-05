// public/js/login.js
(function(){
  const form = document.getElementById('login-form');
  const msg  = document.getElementById('msg');
  if (!form) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();                // 阻止默认 GET 提交 ?email=...&password=...
    msg.textContent = '';

    try{
      const fd = new FormData(form);
      const res = await fetch('/api/login', { method:'POST', body: fd });
      const json = await res.json();

      if (json && json.success) {
        // 与你原逻辑一致：管理员进 /admin，普通用户进 /
        location.href = json.admin ? '/admin' : '/';
      } else {
        msg.textContent = (json && json.error) || 'Login failed';
      }
    }catch(err){
      msg.textContent = 'Network error';
    }
  });
})();