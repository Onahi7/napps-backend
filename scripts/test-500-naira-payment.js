/**
 * Test 500 Naira Payment using Fast Payment API
 * 
 * This script tests the new Flutterwave V4 fast payment implementation
 * with a small amount (500 naira) to verify everything works.
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test payment data
const testPaymentData = {
  amount: 500, // 500 naira
  currency: 'NGN',
  reference: `TEST-${Date.now()}`,
  customer: {
    email: 'test@napps.com',
    name: {
      first: 'Test',
      last: 'User',
    },
    phone: {
      country_code: '234',
      number: '8012345678',
    },
  },
  payment_method: {
    type: 'opay', // OPay is fastest for testing
  },
  redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/callback`,
  meta: {
    test: true,
    description: 'Test payment of 500 naira',
  },
};

async function testFastPayment() {
  console.log('🚀 Testing Fast Payment API with 500 Naira...\n');
  console.log('Payment Details:');
  console.log('- Amount: ₦500');
  console.log('- Method: OPay');
  console.log('- Reference:', testPaymentData.reference);
  console.log('- Customer:', testPaymentData.customer.email);
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // Step 1: Initialize payment
    console.log('📤 Step 1: Initializing payment...');
    const response = await axios.post(
      `${API_BASE_URL}/fast-payments/initialize`,
      testPaymentData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Payment initialized successfully!\n');
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');

    const { data } = response.data;

    // Step 2: Check next action
    if (data.next_action) {
      console.log('📋 Next Action Required:');
      console.log('Type:', data.next_action.type);

      if (data.next_action.type === 'redirect_url') {
        console.log('\n🔗 Payment URL:');
        console.log(data.next_action.redirect_url.url);
        console.log('\n💡 Open this URL in your browser to complete the payment');
        console.log('\n📱 Or scan this QR code (if you have a QR generator):');
        console.log(data.next_action.redirect_url.url);
      } else if (data.next_action.type === 'payment_instruction') {
        console.log('\n📝 Payment Instructions:');
        console.log(data.next_action.payment_instruction.note);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
    console.log('💾 Charge ID:', data.id);
    console.log('📊 Status:', data.status);
    console.log('💰 Amount:', data.amount, data.currency);
    console.log('\n' + '='.repeat(60) + '\n');

    // Step 3: Wait a bit and verify
    console.log('⏳ Waiting 5 seconds before verification...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🔍 Step 2: Verifying payment status...');
    const verifyResponse = await axios.get(
      `${API_BASE_URL}/fast-payments/verify/${data.id}`
    );

    console.log('✅ Verification complete!\n');
    console.log('Current Status:', verifyResponse.data.data.status);
    
    if (verifyResponse.data.data.status === 'succeeded') {
      console.log('🎉 Payment successful!');
    } else if (verifyResponse.data.data.status === 'pending') {
      console.log('⏳ Payment is pending. Complete the payment using the URL above.');
    } else {
      console.log('❌ Payment status:', verifyResponse.data.data.status);
    }

    console.log('\n' + '='.repeat(60) + '\n');
    console.log('✨ Test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Open the payment URL in your browser');
    console.log('2. Complete the payment with OPay test credentials');
    console.log('3. Check webhook logs for payment confirmation');
    console.log('4. Verify payment status again using the charge ID');

    return {
      success: true,
      chargeId: data.id,
      reference: testPaymentData.reference,
      paymentUrl: data.next_action?.redirect_url?.url,
    };

  } catch (error) {
    console.error('❌ Test failed!\n');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }

    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure the backend server is running');
    console.log('2. Check that Flutterwave credentials are configured');
    console.log('3. Verify API_BASE_URL is correct:', API_BASE_URL);
    console.log('4. Check backend logs for more details');

    return {
      success: false,
      error: error.message,
    };
  }
}

// Alternative: Test with card payment
async function testCardPayment() {
  console.log('🚀 Testing Card Payment with 500 Naira...\n');

  try {
    // Step 1: Encrypt card details
    console.log('🔐 Step 1: Encrypting card details...');
    const encryptResponse = await axios.post(
      `${API_BASE_URL}/fast-payments/encrypt-card`,
      {
        card_number: '5531886652142950', // Test card
        expiry_month: '09',
        expiry_year: '32',
        cvv: '564',
      }
    );

    console.log('✅ Card encrypted successfully!\n');

    // Step 2: Initialize payment with encrypted card
    console.log('📤 Step 2: Initializing card payment...');
    const paymentData = {
      ...testPaymentData,
      payment_method: {
        type: 'card',
        card: encryptResponse.data,
      },
    };

    const response = await axios.post(
      `${API_BASE_URL}/fast-payments/initialize`,
      paymentData
    );

    console.log('✅ Payment initialized!\n');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    const { data } = response.data;

    // Step 3: Handle authorization if needed
    if (data.next_action?.type === 'requires_pin') {
      console.log('\n🔑 PIN required. In a real app, you would:');
      console.log('1. Prompt user for PIN');
      console.log('2. Encrypt the PIN');
      console.log('3. Call /fast-payments/authorize with encrypted PIN');
      console.log('\nTest PIN: 3310');
    } else if (data.next_action?.type === 'requires_otp') {
      console.log('\n📱 OTP required. In a real app, you would:');
      console.log('1. Prompt user for OTP');
      console.log('2. Call /fast-payments/authorize with OTP code');
      console.log('\nTest OTP: 12345');
    }

    return {
      success: true,
      chargeId: data.id,
      reference: paymentData.reference,
    };

  } catch (error) {
    console.error('❌ Card payment test failed!');
    console.error(error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

// Get configuration
async function getConfig() {
  try {
    console.log('⚙️  Fetching Flutterwave configuration...\n');
    const response = await axios.get(`${API_BASE_URL}/fast-payments/config`);
    
    console.log('Configuration:');
    console.log('- Client ID:', response.data.clientId ? '✅ Set' : '❌ Not set');
    console.log('- Encryption Key:', response.data.encryptionKey ? '✅ Set' : '❌ Not set');
    console.log('- Test Mode:', response.data.isTestMode ? '✅ Yes (Sandbox)' : '❌ No (Production)');
    console.log('\n' + '='.repeat(60) + '\n');

    return response.data;
  } catch (error) {
    console.error('❌ Failed to get configuration');
    console.error(error.message);
    return null;
  }
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  FLUTTERWAVE V4 FAST PAYMENT TEST - 500 NAIRA');
  console.log('='.repeat(60) + '\n');

  // Check configuration first
  const config = await getConfig();
  if (!config) {
    console.log('❌ Cannot proceed without configuration');
    process.exit(1);
  }

  if (!config.isTestMode) {
    console.log('⚠️  WARNING: Running in PRODUCTION mode!');
    console.log('This will charge real money. Press Ctrl+C to cancel.\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Choose test type
  const testType = process.argv[2] || 'opay';

  if (testType === 'card') {
    await testCardPayment();
  } else {
    await testFastPayment();
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testFastPayment, testCardPayment, getConfig };
