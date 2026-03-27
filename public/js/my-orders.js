(async function () {
  const res = await fetch('/api/my-orders');
  const orders = await res.json();

  const list = document.getElementById('my-order-list');

  list.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-header">
        Order #${o.orderid} — ${o.status} — HK$${o.total}
      </div>
      <div class="order-meta">
        ${o.created_at}
      </div>

      <div class="order-items-title">Items</div>
      <ul class="order-items">
        ${o.items.map(i =>
          `<li> ${i.name ? i.name : '#' + i.pid} × ${i.qty} @ HK$${i.price}</li>`
        ).join('')}
      </ul>
    </div>
  `).join('');
})();