/**
 * Verify Specific Payment References
 * 
 * This script verifies the payment references found in the database
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:3001/api/v1';

// References from the database that need verification
const REFERENCES_TO_VERIFY = [
  'LEVY_1771859666183_904936',
  'LEVY_1771859407381_222409',
  'LEVY_1771858852456_554932',
  'LEVY_1771858637222_504261',
  'LEVY_1771855231217_809707',
  'LEVY_1771853764260_315762',
  'LEVY_1771851962447_648758',
  'LEVY_1771851726630_424184',
];

async function verifyReferences() {
  console.log('🔍 Verifying Payment References with Flutterwave V4 API\n');
  console.log('=' .repeat(80));
  console.log(`\nTotal references to verify: ${REFERENCES_TO_VERIFY.length}\n`);

  const results = {
    success: [],
    failed: [],
    pending: [],
    errors: [],
  };

  for (let i = 0; i < REFERENCES_TO_VERIFY.length; i++) {
    const reference = REFERENCES_TO_VERIFY[i];
    console.log(`\n[${i + 1}/${REFERENCES_TO_VERIFY.length}] Verifying: ${reference}`);

    try {
      const response = await axios.get(
        `${API_BASE_URL}/levy-payments/verify/${reference}`
      );

      const payment = response.data;

      if (payment.status === 'success') {
        results.success.push(payment);
        console.log(`   ✅ SUCCESS - ${payment.memberName}`);
        console.log(`      Receipt: ${payment.receiptNumber}`);
        console.log(`      Amount: ₦${(payment.amount / 100).toLocaleString()}`);
      } else if (payment.status === 'failed') {
        results.failed.push(payment);
        console.log(`   ❌ FAILED - ${payment.failureReason || 'Unknown reason'}`);
      } else {
        results.pending.push(payment);
        console.log(`   ⏳ PENDING - Still processing`);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      const errorDetails = error.response?.data || {};
      results.errors.push({
        reference,
        error: errorMessage,
        details: errorDetails,
        status: error.response?.status,
      });
      console.log(`   ⚠️  ERROR (${error.response?.status || 'Network'}): ${errorMessage}`);
      if (errorDetails.error) {
        console.log(`      Details: ${errorDetails.error}`);
      }
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICATION SUMMARY\n');

  console.log(`Total Verified: ${REFERENCES_TO_VERIFY.length}`);
  console.log(`   ✅ Successful: ${results.success.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);
  console.log(`   ⏳ Pending: ${results.pending.length}`);
  console.log(`   ⚠️  Errors: ${results.errors.length}`);

  if (results.success.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('✅ SUCCESSFUL VERIFICATIONS:\n');
    results.success.forEach((p, i) => {
      console.log(`${i + 1}. ${p.reference}`);
      console.log(`   Member: ${p.memberName}`);
      console.log(`   Email: ${p.email}`);
      console.log(`   Chapter: ${p.chapter}`);
      console.log(`   School: ${p.schoolName}`);
      console.log(`   Receipt: ${p.receiptNumber}`);
      console.log(`   Amount: ₦${(p.amount / 100).toLocaleString()}`);
      console.log('');
    });
  }

  if (results.failed.length > 0) {
    console.log('=' .repeat(80));
    console.log('❌ FAILED VERIFICATIONS:\n');
    results.failed.forEach((p, i) => {
      console.log(`${i + 1}. ${p.reference}`);
      console.log(`   Member: ${p.memberName}`);
      console.log(`   Reason: ${p.failureReason || 'Unknown'}`);
      console.log('');
    });
  }

  if (results.pending.length > 0) {
    console.log('=' .repeat(80));
    console.log('⏳ STILL PENDING:\n');
    results.pending.forEach((p, i) => {
      console.log(`${i + 1}. ${p.reference}`);
      console.log(`   Member: ${p.memberName}`);
      console.log(`   Email: ${p.email}`);
      console.log('');
    });
    console.log('💡 These payments may need more time or manual verification');
  }

  if (results.errors.length > 0) {
    console.log('=' .repeat(80));
    console.log('⚠️  VERIFICATION ERRORS:\n');
    results.errors.forEach((e, i) => {
      console.log(`${i + 1}. ${e.reference}`);
      console.log(`   Error: ${e.error}`);
      console.log('');
    });
  }

  console.log('=' .repeat(80));
  console.log('✅ VERIFICATION COMPLETE!\n');
}

// Check if server is running first
async function checkServer() {
  try {
    await axios.get(`${API_BASE_URL}/levy-payments/stats`);
    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
(async () => {
  console.log('🔌 Checking if backend server is running...');
  const serverRunning = await checkServer();

  if (!serverRunning) {
    console.error('\n❌ Backend server is not running!');
    console.error('\n💡 Please start the server first:');
    console.error('   cd napps-backend');
    console.error('   npm run start:dev');
    console.error('\nThen run this script again.');
    process.exit(1);
  }

  console.log('✅ Server is running\n');
  await verifyReferences();
})();
