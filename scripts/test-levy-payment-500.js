/**
 * Test 500 Naira Levy Payment using existing hosted checkout
 * This uses the working levy payment flow
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

async function testLevyPayment() {
  console.log('\n' + '='.repeat(60));
  console.log('  TEST LEVY PAYMENT - 500 NAIRA');
  console.log('='.repeat(60) + '\n');

  const testData = {
    memberName: 'Test User',
    email: 'test@napps.com',
    phone: '08012345678',
    chapter: 'Lafia',
    schoolName: 'Test School',
    isManualSchoolEntry: true,
    wards: ['Test Ward 1', 'Test Ward 2'],
    amount: 500, // 500 naira for testing
  };

  console.log('Payment Details:');
  console.log('- Amount: ₦500');
  console.log('- Name:', testData.memberName);
  console.log('- Email:', testData.email);
  console.log('- Phone:', testData.phone);
  console.log('- Chapter:', testData.chapter);
  console.log('- School:', testData.schoolName);
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    console.log('📤 Initializing levy payment...\n');

    const response = await axios.post(
      `${API_BASE_URL}/levy-payments/initialize`,
      testData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Payment initialized successfully!\n');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');

    const { reference, paymentUrl, receiptNumber } = response.data;

    console.log('💾 Payment Reference:', reference);
    console.log('📄 Receipt Number:', receiptNumber);
    console.log('💰 Amount: ₦500');
    console.log('\n🔗 Payment URL:');
    console.log(paymentUrl);
    console.log('\n' + '='.repeat(60) + '\n');

    console.log('✨ Next Steps:');
    console.log('1. Open the payment URL in your browser');
    console.log('2. Choose your payment method (OPay, Card, Bank Transfer, etc.)');
    console.log('3. Complete the payment');
    console.log('4. You\'ll be redirected back with the result');
    console.log('\n💡 To verify payment status later, use:');
    console.log(`   GET ${API_BASE_URL}/levy-payments/verify/${reference}`);

    return {
      success: true,
      reference,
      paymentUrl,
      receiptNumber,
    };

  } catch (error) {
    console.error('\n❌ Test failed!\n');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }

    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure the backend server is running');
    console.log('2. Check that Flutterwave credentials are configured');
    console.log('3. Verify MongoDB is connected');
    console.log('4. Check backend logs for more details');

    return {
      success: false,
      error: error.message,
    };
  }
}

// Verify payment
async function verifyPayment(reference) {
  console.log('\n' + '='.repeat(60));
  console.log('  VERIFY PAYMENT');
  console.log('='.repeat(60) + '\n');

  try {
    console.log('🔍 Verifying payment:', reference, '\n');

    const response = await axios.get(
      `${API_BASE_URL}/levy-payments/verify/${reference}`
    );

    console.log('✅ Verification complete!\n');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    const { status, amount, paidAt } = response.data;

    console.log('\n' + '='.repeat(60));
    console.log('Payment Status:', status);
    console.log('Amount:', amount);
    if (paidAt) {
      console.log('Paid At:', new Date(paidAt).toLocaleString());
    }
    console.log('='.repeat(60) + '\n');

    return response.data;

  } catch (error) {
    console.error('\n❌ Verification failed!\n');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }

    return null;
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  const reference = process.argv[3];

  if (command === 'verify' && reference) {
    await verifyPayment(reference);
  } else {
    const result = await testLevyPayment();
    
    if (result.success) {
      console.log('\n📋 To verify this payment later, run:');
      console.log(`   node scripts/test-levy-payment-500.js verify ${result.reference}`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testLevyPayment, verifyPayment };
