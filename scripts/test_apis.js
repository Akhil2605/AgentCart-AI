const http = require('http');
const { app } = require('../backend/server');

async function run() {
  const server = app.listen(0);
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  function req(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`http://localhost:${port}${path}`);
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' }
      };
      const r = http.request(url, opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      r.on('error', reject);
      if (body) r.write(JSON.stringify(body));
      r.end();
    });
  }

  try {
    // 1. Profile GET
    const pRes = await req('/api/profile');
    console.log('GET /api/profile:', pRes.status, pRes.body.profile.name, 'Orders:', pRes.body.stats.total_orders);

    // 2. Profile PUT
    const pPut = await req('/api/profile', 'PUT', {
      phone: '+91 99999 88888',
      city: 'Bengaluru'
    });
    console.log('PUT /api/profile:', pPut.status, pPut.body.profile.phone);

    // 3. Orders GET
    const oRes = await req('/api/orders?limit=2');
    console.log('GET /api/orders:', oRes.status, 'Count:', oRes.body.count, 'First order ID:', oRes.body.orders[0].id);

    // 4. Order Tracking GET
    const trRes = await req(`/api/orders/${oRes.body.orders[0].id}/tracking`);
    console.log('GET /api/orders/:id/tracking:', trRes.status, 'Timeline stages:', trRes.body.tracking.timeline.length);

    // 5. Payments GET
    const payRes = await req('/api/payments?limit=2');
    console.log('GET /api/payments:', payRes.status, 'Count:', payRes.body.count, 'First payment:', payRes.body.payments[0].id);

    // 6. Domestic India rejection check
    const domRes = await req('/api/paypal/create-order', 'POST', {
      items: [{ id: 'cyber-shell-black', quantity: 1 }],
      shipping_address: {
        name: 'Domestic Buyer',
        email: 'dom@example.com',
        address: 'MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postal_code: '560001',
        country: 'India'
      }
    });
    console.log('POST /api/paypal/create-order (Domestic India check):', domRes.status, domRes.body.error);
    if (domRes.status !== 400 || !domRes.body.error.includes('domestic payments within India')) {
      throw new Error('Domestic payment was not blocked!');
    }

    console.log('\nAll new API tests passed with flying colors!');
  } finally {
    server.close();
  }
}

run().catch(err => {
  console.error('API test failed:', err);
  process.exit(1);
});
