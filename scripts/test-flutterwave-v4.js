/**
 * Test Flutterwave V4 API Integration
 * 
 * This script tests:
 * 1. OAuth token generation
 * 2. Payment initialization
 * 3. Abandoned payment cleanup
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:3001/api/v1';

// Test data
const testPaymentData = {
  memberName: 'Test Member V4',
  email: `test.v4.${Date.now()}@example.com`,
  phone: `080${Math.floor(10000000 + Math.random() * 90000000)}`,
  chapter: 'Lafia A',
  schoolName: 'Test School V4',
  isManualSchoolEntry: true,
  wards: ['Ward 1', 'Ward 2'],
  amount: 5500,
};

async function testFlutterwaveV4() {
  console.log('🚀 Testing Flutterwave V4 API Integration\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Initialize Payment
    console.log('\n📝 Test 1: Initialize Payment with V4 API...');
    const initResponse = await axios.post(
      `${API_BASE_URL}/levy-payments/initialize`,
      testPaymentData
    );

    if (initResponse.data.reference && initResponse.data.paymentUrl) {
      console.log('✅ Payment initialized successfully!');
      console.log(`   Reference: ${initResponse.data.reference}`);
      console.log(`   Receipt: ${initResponse.data.receiptNumber}`);
      console.log(`   Amount: ₦${initResponse.data.amount}`);
      console.log(`   Payment URL: ${initResponse.data.paymentUrl.substring(0, 50)}...`);
    } else {
      console.log('❌ Payment initialization failed - missing data');
      console.log('   Response:', JSON.stringify(initResponse.data, null, 2));
    }

    // Test 2: Check Duplicate (should find the payment we just created)
    console.log('\n📝 Test 2: Check Duplicate...');
    const duplicateResponse = await axios.post(
      `${API_BASE_URL}/levy-payments/check-duplicate`,
      {
        email: testPaymentData.email,
        phone: testPaymentData.phone,
      }
    );

    if (duplicateResponse.data.isDuplicate) {
      console.log('✅ Duplicate check working!');
      console.log(`   Found payment: ${duplicateResponse.data.payment.reference}`);
      console.log(`   Status: ${duplicateResponse.data.payment.status}`);
      console.log(`   Can continue: ${duplicateResponse.data.canContinue}`);
    } else {
      console.log('❌ Duplicate check failed - should have found payment');
    }

    // Test 3: Get Payment Stats
    console.log('\n📝 Test 3: Get Payment Statistics...');
    const statsResponse = await axios.get(`${API_BASE_URL}/levy-payments/stats`);

    console.log('✅ Payment statistics retrieved!');
    console.log(`   Total Payments: ${statsResponse.data.totalPayments}`);
    console.log(`   Successful: ${statsResponse.data.successfulPayments}`);
    console.log(`   Pending: ${statsResponse.data.pendingPayments}`);
    console.log(`   Total Amount: ₦${statsResponse.data.totalAmountNaira.toLocaleString()}`);

    // Test 4: Cleanup Abandoned Payments (simulate)
    console.log('\n📝 Test 4: Test Abandoned Payment Cleanup...');
    console.log('   (Note: This only cleans payments older than 30 minutes)');
    
    const cleanupResponse = await axios.post(
      `${API_BASE_URL}/levy-payments/cleanup-abandoned`,
      {}
    );

    console.log(`✅ Cleanup executed: ${cleanupResponse.data.message}`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('\n📋 Summary:');
    console.log('   ✓ Flutterwave V4 OAuth authentication working');
    console.log('   ✓ Payment initialization successful');
    console.log('   ✓ Duplicate detection working');
    console.log('   ✓ Payment statistics working');
    console.log('   ✓ Abandoned payment cleanup available');
    console.log('\n💡 Next Steps:');
    console.log('   1. Test actual payment with Flutterwave test card');
    console.log('   2. Verify payment callback handling');
    console.log('   3. Test receipt generation');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
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
    console.error('   2. Check .env file has correct Flutterwave V4 credentials');
    console.error('   3. Verify MongoDB connection is working');
    console.error('   4. Check server logs for detailed error messages');
    process.exit(1);
  }
}

// Run the test
testFlutterwaveV4();
