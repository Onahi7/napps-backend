/**
 * List All Payment References from MongoDB
 * 
 * This script connects directly to MongoDB and lists all payment references
 * without needing the backend server to be running.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function listPaymentReferences() {
  console.log('🔍 Listing All Payment References from MongoDB\n');
  console.log('=' .repeat(80));

  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env file');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const paymentsCollection = db.collection('levypayments');

    // Get all payments
    console.log('\n📋 Fetching all levy payments...');
    const payments = await paymentsCollection
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`✅ Found ${payments.length} payment(s)\n`);

    if (payments.length === 0) {
      console.log('⚠️  No payments found in database');
      return;
    }

    // Group by status
    const byStatus = {
      success: [],
      pending: [],
      processing: [],
      failed: [],
      abandoned: [],
      other: [],
    };

    payments.forEach((payment) => {
      const status = payment.status || 'other';
      if (byStatus[status]) {
        byStatus[status].push(payment);
      } else {
        byStatus.other.push(payment);
      }
    });

    // Display summary
    console.log('=' .repeat(80));
    console.log('📊 PAYMENT STATUS SUMMARY\n');
    console.log(`   ✅ Success: ${byStatus.success.length}`);
    console.log(`   ⏳ Pending: ${byStatus.pending.length}`);
    console.log(`   🔄 Processing: ${byStatus.processing.length}`);
    console.log(`   ❌ Failed: ${byStatus.failed.length}`);
    console.log(`   🚫 Abandoned: ${byStatus.abandoned.length}`);
    if (byStatus.other.length > 0) {
      console.log(`   ❓ Other: ${byStatus.other.length}`);
    }

    // Display successful payments
    if (byStatus.success.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log(`✅ SUCCESSFUL PAYMENTS (${byStatus.success.length}):\n`);

      byStatus.success.forEach((payment, index) => {
        console.log(`${index + 1}. Reference: ${payment.reference}`);
        console.log(`   Receipt: ${payment.receiptNumber}`);
        console.log(`   Member: ${payment.memberName}`);
        console.log(`   Email: ${payment.email}`);
        console.log(`   Phone: ${payment.phone}`);
        console.log(`   Chapter: ${payment.chapter}`);
        console.log(`   School: ${payment.schoolName}`);
        console.log(`   Amount: ₦${(payment.amount / 100).toLocaleString()}`);
        if (payment.paidAt) {
          console.log(`   Paid: ${new Date(payment.paidAt).toLocaleString('en-NG')}`);
        }
        if (payment.flutterwaveTransactionId) {
          console.log(`   FLW TX ID: ${payment.flutterwaveTransactionId}`);
        }
        console.log('');
      });
    }

    // Display pending/processing payments
    const needsVerification = [...byStatus.pending, ...byStatus.processing];
    if (needsVerification.length > 0) {
      console.log('=' .repeat(80));
      console.log(`⏳ PAYMENTS NEEDING VERIFICATION (${needsVerification.length}):\n`);

      needsVerification.forEach((payment, index) => {
        console.log(`${index + 1}. Reference: ${payment.reference}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Member: ${payment.memberName}`);
        console.log(`   Email: ${payment.email}`);
        console.log(`   Chapter: ${payment.chapter}`);
        console.log(`   Created: ${new Date(payment.createdAt).toLocaleString('en-NG')}`);
        if (payment.paymentUrl) {
          console.log(`   Payment URL: ${payment.paymentUrl.substring(0, 60)}...`);
        }
        console.log('');
      });

      console.log('💡 To verify these payments:');
      console.log('   1. Start the backend server: npm run start:dev');
      console.log('   2. Run: node scripts/verify-all-payments.js');
      console.log('   OR');
      console.log('   3. Visit the verification URL in browser for each reference:');
      console.log('      http://localhost:8080/levy-payment/verify?reference=<REFERENCE>');
    }

    // Display failed payments
    if (byStatus.failed.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log(`❌ FAILED PAYMENTS (${byStatus.failed.length}):\n`);

      byStatus.failed.forEach((payment, index) => {
        console.log(`${index + 1}. Reference: ${payment.reference}`);
        console.log(`   Member: ${payment.memberName}`);
        console.log(`   Email: ${payment.email}`);
        console.log(`   Reason: ${payment.failureReason || 'Unknown'}`);
        console.log('');
      });
    }

    // Calculate statistics
    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const successAmount = byStatus.success.reduce((sum, p) => sum + (p.amount || 0), 0);

    console.log('=' .repeat(80));
    console.log('📈 STATISTICS\n');
    console.log(`   Total Payments: ${payments.length}`);
    console.log(`   Total Amount: ₦${(totalAmount / 100).toLocaleString()}`);
    console.log(`   Successful Amount: ₦${(successAmount / 100).toLocaleString()}`);
    console.log(`   Success Rate: ${((byStatus.success.length / payments.length) * 100).toFixed(1)}%`);

    // Group by chapter
    const byChapter = {};
    payments.forEach((payment) => {
      const chapter = payment.chapter || 'Unknown';
      if (!byChapter[chapter]) {
        byChapter[chapter] = { count: 0, amount: 0, success: 0 };
      }
      byChapter[chapter].count++;
      byChapter[chapter].amount += payment.amount || 0;
      if (payment.status === 'success') {
        byChapter[chapter].success++;
      }
    });

    console.log('\n   Payments by Chapter:');
    Object.entries(byChapter)
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([chapter, data]) => {
        console.log(`      ${chapter}: ${data.count} payment(s) (${data.success} successful) - ₦${(data.amount / 100).toLocaleString()}`);
      });

    console.log('\n' + '='.repeat(80));
    console.log('✅ LISTING COMPLETE!\n');

  } catch (error) {
    console.error('\n❌ ERROR!');
    console.error(`   ${error.message}`);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check MONGODB_URI in .env file');
    console.error('   2. Ensure MongoDB Atlas allows your IP address');
    console.error('   3. Verify database name is correct');
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script
listPaymentReferences();
