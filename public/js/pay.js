(async function () {
  const url = new URL(location.href);
  const orderid = url.searchParams.get('orderid');

  const res = await fetch('/api/paypal/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderid })
  });

  const json = await res.json();

  if (!json || !json.links) {
    alert(json?.error || 'PayPal request failed');
    return;
  }

  const approve = json.links.find(l => l.rel === 'approve');
  if (!approve) {
    alert('No PayPal approval link found.');
    return;
  }

  // 跳转 PayPal
  location.href = approve.href;
})();
