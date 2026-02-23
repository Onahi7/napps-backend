/**
 * Verify All Payment References from Dashboard
 * 
 * This script:
 * 1. Fetches all levy payments from the database
 * 2. Attempts to verify each payment with Flutterwave V4 API
 * 3. Reports on payment statuses
 * 4. Identifies any issues with verification
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:3001/api/v1';

async function verifyAllPayments() {
  console.log('🔍 Fetching and Verifying All Payment References\n');
  console.log('=' .repeat(80));

  try {
    // Step 1: Fetch all payments
    console.log('\n📋 Step 1: Fetching all levy payments from database...');
    const paymentsResponse = await axios.get(
      `${API_BASE_URL}/levy-payments?page=1&limit=100&sortBy=createdAt&sortOrder=desc`
    );

    const payments = paymentsResponse.data.data;
    const totalPayments = paymentsResponse.data.pagination.total;

    console.log(`✅ Found ${totalPayments} total payment(s)`);
    console.log(`   Fetched ${payments.length} payment(s) for verification`);

    if (payments.length === 0) {
      console.log('\n⚠️  No payments found to verify');
      return;
    }

    // Step 2: Group payments by status
    const paymentsByStatus = {
      success: [],
      pending: [],
      processing: [],
      failed: [],
      abandoned: [],
      other: [],
    };

    payments.forEach((payment) => {
      const status = payment.status || 'other';
      if (paymentsByStatus[status]) {
        paymentsByStatus[status].push(payment);
      } else {
        paymentsByStatus.other.push(payment);
      }
    });

    console.log('\n📊 Payment Status Summary:');
    console.log(`   ✅ Success: ${paymentsByStatus.success.length}`);
    console.log(`   ⏳ Pending: ${paymentsByStatus.pending.length}`);
    console.log(`   🔄 Processing: ${paymentsByStatus.processing.length}`);
    console.log(`   ❌ Failed: ${paymentsByStatus.failed.length}`);
    console.log(`   🚫 Abandoned: ${paymentsByStatus.abandoned.length}`);
    if (paymentsByStatus.other.length > 0) {
      console.log(`   ❓ Other: ${paymentsByStatus.other.length}`);
    }

    // Step 3: Verify pending and processing payments
    const paymentsToVerify = [
      ...paymentsByStatus.pending,
      ...paymentsByStatus.processing,
    ];

    if (paymentsToVerify.length === 0) {
      console.log('\n✅ No pending or processing payments to verify');
    } else {
      console.log(`\n🔍 Step 2: Verifying ${paymentsToVerify.length} pending/processing payment(s)...\n`);

      const verificationResults = {
        nowSuccess: [],
        stillPending: [],
        nowFailed: [],
        errors: [],
      };

      for (const payment of paymentsToVerify) {
        try {
          console.log(`   Verifying: ${payment.reference}...`);
          
          const verifyResponse = await axios.get(
            `${API_BASE_URL}/levy-payments/verify/${payment.reference}`
          );

          const verifiedPayment = verifyResponse.data;

          if (verifiedPayment.status === 'success') {
            verificationResults.nowSuccess.push(verifiedPayment);
            console.log(`      ✅ Now SUCCESS - ${verifiedPayment.memberName}`);
          } else if (verifiedPayment.status === 'failed') {
            verificationResults.nowFailed.push(verifiedPayment);
            console.log(`      ❌ Now FAILED - ${verifiedPayment.failureReason || 'Unknown reason'}`);
          } else {
            verificationResults.stillPending.push(verifiedPayment);
            console.log(`      ⏳ Still PENDING`);
          }
        } catch (error) {
          verificationResults.errors.push({
            reference: payment.reference,
            error: error.response?.data?.message || error.message,
          });
          console.log(`      ⚠️  ERROR: ${error.response?.data?.message || error.message}`);
        }
      }

      // Step 4: Report verification results
      console.log('\n' + '='.repeat(80));
      console.log('📊 VERIFICATION RESULTS\n');

      if (verificationResults.nowSuccess.length > 0) {
        console.log(`✅ ${verificationResults.nowSuccess.length} payment(s) now SUCCESSFUL:`);
        verificationResults.nowSuccess.forEach((p) => {
          console.log(`   - ${p.reference} | ${p.memberName} | ₦${(p.amount / 100).toLocaleString()}`);
        });
        console.log('');
      }

      if (verificationResults.nowFailed.length > 0) {
        console.log(`❌ ${verificationResults.nowFailed.length} payment(s) now FAILED:`);
        verificationResults.nowFailed.forEach((p) => {
          console.log(`   - ${p.reference} | ${p.failureReason || 'Unknown'}`);
        });
        console.log('');
      }

      if (verificationResults.stillPending.length > 0) {
        console.log(`⏳ ${verificationResults.stillPending.length} payment(s) still PENDING:`);
        verificationResults.stillPending.forEach((p) => {
          console.log(`   - ${p.reference} | ${p.memberName}`);
        });
        console.log('');
      }

      if (verificationResults.errors.length > 0) {
        console.log(`⚠️  ${verificationResults.errors.length} verification ERROR(S):`);
        verificationResults.errors.forEach((e) => {
          console.log(`   - ${e.reference} | ${e.error}`);
        });
        console.log('');
      }
    }

    // Step 5: Display successful payments details
    if (paymentsByStatus.success.length > 0) {
      console.log('=' .repeat(80));
      console.log(`\n✅ SUCCESSFUL PAYMENTS (${paymentsByStatus.success.length}):\n`);

      paymentsByStatus.success.forEach((payment, index) => {
        console.log(`${index + 1}. ${payment.reference}`);
        console.log(`   Member: ${payment.memberName}`);
        console.log(`   Email: ${payment.email}`);
        console.log(`   Phone: ${payment.phone}`);
        console.log(`   Chapter: ${payment.chapter}`);
        console.log(`   School: ${payment.schoolName}`);
        console.log(`   Amount: ₦${(payment.amount / 100).toLocaleString()}`);
        console.log(`   Receipt: ${payment.receiptNumber}`);
        if (payment.paidAt) {
          console.log(`   Paid At: ${new Date(payment.paidAt).toLocaleString('en-NG')}`);
        }
        console.log('');
      });
    }

    // Step 6: Get payment statistics
    console.log('=' .repeat(80));
    console.log('\n📈 PAYMENT STATISTICS:\n');

    const statsResponse = await axios.get(`${API_BASE_URL}/levy-payments/stats`);
    const stats = statsResponse.data;

    console.log(`   Total Payments: ${stats.totalPayments}`);
    console.log(`   Successful: ${stats.successfulPayments}`);
    console.log(`   Pending: ${stats.pendingPayments}`);
    console.log(`   Failed: ${stats.failedPayments}`);
    console.log(`   Total Amount: ₦${stats.totalAmountNaira.toLocaleString()}`);
    console.log(`   Success Rate: ${((stats.successfulPayments / stats.totalPayments) * 100).toFixed(1)}%`);

    if (stats.paymentsByChapter && Object.keys(stats.paymentsByChapter).length > 0) {
      console.log('\n   Payments by Chapter:');
      Object.entries(stats.paymentsByChapter).forEach(([chapter, data]) => {
        console.log(`      ${chapter}: ${data.count} payment(s) - ₦${(data.amount / 100).toLocaleString()}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICATION COMPLETE!\n');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED!');
    console.error('\nError Details:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data.message || error.response.statusText}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`   ${error.message}`);
    }
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Ensure backend server is running on port 3001');
    console.error('   2. Check MongoDB connection');
    console.error('   3. Verify Flutterwave V4 credentials in .env');
    console.error('   4. Check server logs for detailed errors');
    process.exit(1);
  }
}

// Run the verification
verifyAllPayments();
