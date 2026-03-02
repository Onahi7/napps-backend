/**
 * Initialize payment via app endpoint (hosted checkout)
 * User then chooses payment method on Flutterwave checkout page.
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE_URL || 'https://api.nappsnasarawa.com/api/v1';

async function main() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  const phone = `0803${rand.toString().padStart(5, '0')}67`;
  const payload = {
    memberName: 'Prince Samiyu PA',
    email: `real.pay.${ts}@nappsnasarawa.com`,
    phone,
    chapter: 'Lafia A',
    schoolName: 'Test School',
    isManualSchoolEntry: true,
    wards: ['Ward 1'],
    amount: 500,
  };

  console.log('Initializing hosted payment (₦500) via app endpoint...');
  console.log(`Endpoint: ${API_BASE}/levy-payments/initialize`);

  try {
    const res = await axios.post(`${API_BASE}/levy-payments/initialize`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('\n✅ Initialized successfully');
    console.log(`Reference: ${res.data.reference}`);
    console.log(`Amount: ₦${res.data.amount}`);
    console.log(`Checkout URL: ${res.data.paymentUrl}`);
    console.log('\nOpen Checkout URL in browser and user can choose payment method there.');
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error(`\n❌ Initialization failed (HTTP ${status || 'N/A'})`);
    console.error(JSON.stringify(data || err.message, null, 2));
  }
}

main();
