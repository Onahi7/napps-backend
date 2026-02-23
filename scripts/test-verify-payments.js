/**
 * Flutterwave payment reconciliation script
 *
 * Problem: Payments were initialized via V3 API (CLIENT_SECRET used as direct
 * Bearer token). V4 OAuth tokens are rejected by the V3 verify endpoint.
 *
 * Strategy:
 *   1. Try V3 verify_by_reference using CLIENT_SECRET directly as Bearer token
 *      (same auth that worked for initialization)
 *   2. Fall back to V4 OAuth + V3 endpoint
 *   3. Report any status mismatches so they can be synced
 */

const axios = require('axios');
require('dotenv').config();

const CLIENT_ID = process.env.FLUTTERWAVE_CLIENT_ID;
const CLIENT_SECRET = process.env.FLUTTERWAVE_CLIENT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

// ── Auth helpers ────────────────────────────────────────────────────────────

async function getOAuthToken() {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('grant_type', 'client_credentials');
  const res = await axios.post(
    'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

// ── Verify helpers ──────────────────────────────────────────────────────────

async function verifyV3Direct(txRef) {
  // Use CLIENT_SECRET as Bearer token directly to V3 API
  // (same way initialization worked)
  try {
    const res = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      { headers: { Authorization: `Bearer ${CLIENT_SECRET}`, 'Content-Type': 'application/json' } }
    );
    return { ok: true, method: 'v3-direct', data: res.data };
  } catch (err) {
    return { ok: false, method: 'v3-direct', status: err.response?.status, data: err.response?.data };
  }
}

async function verifyV3OAuth(oauthToken, txRef) {
  // Use V4 OAuth token against V3 endpoint
  try {
    const res = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      { headers: { Authorization: `Bearer ${oauthToken}`, 'Content-Type': 'application/json' } }
    );
    return { ok: true, method: 'v3-oauth', data: res.data };
  } catch (err) {
    return { ok: false, method: 'v3-oauth', status: err.response?.status, data: err.response?.data };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Flutterwave Payment Reconciliation ===\n');

  // 1. Get OAuth token (for fallback test)
  let oauthToken;
  try {
    oauthToken = await getOAuthToken();
    console.log('✅ V4 OAuth token obtained\n');
  } catch (err) {
    console.error('❌ V4 OAuth token failed:', err.response?.data || err.message);
  }

  // 2. Fetch ALL unverified payments from DB
  const mongoose = require('mongoose');
  await mongoose.connect(MONGODB_URI);

  const payments = await mongoose.connection.db
    .collection('levypayments')
    .find(
      { status: { $in: ['pending', 'processing'] } },
      { projection: { reference: 1, status: 1, memberName: 1, email: 1, amount: 1 } }
    )
    .sort({ createdAt: -1 })
    .toArray();

  console.log(`Found ${payments.length} unverified payments (pending/processing)\n`);

  if (payments.length === 0) {
    console.log('Nothing to reconcile.');
    await mongoose.disconnect();
    return;
  }

  // 3. Test which method works on first payment
  console.log('--- Probing auth method on first reference ---');
  const probe = payments[0];
  const v3Direct = await verifyV3Direct(probe.reference);
  const workingMethod = v3Direct.ok ? 'v3-direct' : 'v3-oauth';

  if (v3Direct.ok) {
    console.log('✅ V3-direct (CLIENT_SECRET as Bearer) works!\n');
  } else {
    console.log(`❌ V3-direct failed (HTTP ${v3Direct.status}): ${JSON.stringify(v3Direct.data)}`);
    if (oauthToken) {
      const v3OAuth = await verifyV3OAuth(oauthToken, probe.reference);
      if (v3OAuth.ok) {
        console.log('✅ V3-OAuth fallback works!\n');
      } else {
        console.log(`❌ V3-OAuth also failed (HTTP ${v3OAuth.status}): ${JSON.stringify(v3OAuth.data)}`);
        console.log('\n⚠️  Neither auth method can reach Flutterwave. These transactions may have');
        console.log('   been created with a DIFFERENT V3 secret key that is no longer configured.');
        console.log('   Check your Flutterwave dashboard for the old FLWSECK-xxx secret key.\n');
      }
    }
  }

  // 4. Verify all unverified payments
  console.log('--- Verifying all unverified payments ---\n');
  const results = { matched: [], mismatch: [], notFound: [], error: [] };

  for (const p of payments) {
    const result = workingMethod === 'v3-direct'
      ? await verifyV3Direct(p.reference)
      : await verifyV3OAuth(oauthToken, p.reference);

    if (result.ok) {
      const d = result.data.data;
      const gwStatus = d?.status;
      const isSuccess = gwStatus === 'successful' || gwStatus === 'succeeded';

      if (isSuccess) {
        console.log(`  ⚠️  PAID BUT UNSYNCED: ${p.reference}`);
        console.log(`     Member: ${p.memberName} | Amount: ₦${(p.amount / 100).toLocaleString()}`);
        console.log(`     Flutterwave: ${gwStatus} | DB: ${p.status}`);
        results.mismatch.push({ reference: p.reference, memberName: p.memberName, gwStatus });
      } else {
        console.log(`  ○  ${p.reference} — Flutterwave: ${gwStatus} (matches DB: ${p.status})`);
        results.matched.push(p.reference);
      }
    } else if (result.status === 404) {
      console.log(`  ✗  ${p.reference} — NOT FOUND in Flutterwave (abandoned/invalid init)`);
      results.notFound.push(p.reference);
    } else {
      console.log(`  ✗  ${p.reference} — Error HTTP ${result.status}: ${JSON.stringify(result.data)}`);
      results.error.push(p.reference);
    }
  }

  // 5. Summary
  console.log('\n=== Summary ===');
  console.log(`  Paid but not synced in DB : ${results.mismatch.length}`);
  console.log(`  Still pending/processing  : ${results.matched.length}`);
  console.log(`  Not found in Flutterwave  : ${results.notFound.length}`);
  console.log(`  Errors                    : ${results.error.length}`);

  if (results.mismatch.length > 0) {
    console.log('\n⚠️  The following payments need to be synced — call their verify endpoint:\n');
    for (const r of results.mismatch) {
      console.log(`  GET /api/v1/levy-payments/verify/${r.reference}  (${r.memberName})`);
    }
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
