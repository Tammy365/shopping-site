// public/js/register.js
(function(){
  const form = document.getElementById('reg-form');
  const msg  = document.getElementById('msg');
  if (!form) return;

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.textContent = '';

    const fd = new FormData(form);
    if (fd.get('password') !== fd.get('password2')) {
      msg.textContent = 'Passwords do not match!';
      return;
    }
    try{
      const res = await fetch('/api/register', { method:'POST', body: fd });
      const json = await res.json();
      if (json && json.success) {
        location.href = '/login.html';
      } else {
        msg.textContent = (json && json.error) || 'Registration failed';
      }
    }catch(err){
      msg.textContent = 'Network error';
    }
  });
})();