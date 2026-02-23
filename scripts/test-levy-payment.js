/**
 * Test script for Levy Payment Flow
 * Tests the complete payment initialization and validation
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

// Test data
const testPaymentData = {
  memberName: 'Test Member',
  email: `test${Date.now()}@example.com`, // Unique email for each test
  phone: `080${Math.floor(10000000 + Math.random() * 90000000)}`, // Random phone
  chapter: 'Lafia A',
  schoolName: 'Test School',
  isManualSchoolEntry: true,
  wards: ['Ward 1', 'Ward 2'],
  amount: 5500,
};

async function testPaymentInitialization() {
  console.log('🧪 Testing Levy Payment Initialization...\n');
  console.log('Test Data:', JSON.stringify(testPaymentData, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // Step 1: Check duplicate
    console.log('Step 1: Checking for duplicates...');
    const duplicateResponse = await fetch(`${API_BASE_URL}/levy-payments/check-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testPaymentData.email,
        phone: testPaymentData.phone,
      }),
    });

    if (!duplicateResponse.ok) {
      throw new Error(`Duplicate check failed: ${duplicateResponse.status}`);
    }

    const duplicateData = await duplicateResponse.json();
    console.log('✅ Duplicate check result:', duplicateData);
    console.log('\n' + '='.repeat(60) + '\n');

    // Step 2: Initialize payment
    console.log('Step 2: Initializing payment...');
    const initResponse = await fetch(`${API_BASE_URL}/levy-payments/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPaymentData),
    });

    if (!initResponse.ok) {
      const errorData = await initResponse.json();
      throw new Error(`Payment initialization failed: ${JSON.stringify(errorData)}`);
    }

    const initData = await initResponse.json();
    console.log('✅ Payment initialized successfully!');
    console.log('Payment Details:');
    console.log('  - Reference:', initData.reference);
    console.log('  - Receipt Number:', initData.receiptNumber);
    console.log('  - Amount:', `₦${initData.amount.toLocaleString()}`);
    console.log('  - Payment URL:', initData.paymentUrl);
    console.log('\n' + '='.repeat(60) + '\n');

    // Step 3: Verify payment record was created
    console.log('Step 3: Verifying payment record...');
    const verifyResponse = await fetch(`${API_BASE_URL}/levy-payments/${initData.reference}`);

    if (!verifyResponse.ok) {
      throw new Error(`Payment record verification failed: ${verifyResponse.status}`);
    }

    const paymentRecord = await verifyResponse.json();
    console.log('✅ Payment record verified!');
    console.log('Record Details:');
    console.log('  - Status:', paymentRecord.status);
    console.log('  - Member Name:', paymentRecord.memberName);
    console.log('  - Email:', paymentRecord.email);
    console.log('  - Phone:', paymentRecord.phone);
    console.log('  - Chapter:', paymentRecord.chapter);
    console.log('  - School:', paymentRecord.schoolName);
    console.log('  - Wards:', paymentRecord.wards.join(', '));
    console.log('\n' + '='.repeat(60) + '\n');

    // Step 4: Test schools endpoint
    console.log('Step 4: Testing schools endpoint...');
    const schoolsResponse = await fetch(`${API_BASE_URL}/levy-payments/schools/postgres?chapter=${encodeURIComponent(testPaymentData.chapter)}`);

    if (!schoolsResponse.ok) {
      throw new Error(`Schools fetch failed: ${schoolsResponse.status}`);
    }

    const schools = await schoolsResponse.json();
    console.log(`✅ Schools fetched successfully! Found ${schools.length} schools for ${testPaymentData.chapter}`);
    if (schools.length > 0) {
      console.log('Sample schools:');
      schools.slice(0, 3).forEach((school, idx) => {
        console.log(`  ${idx + 1}. ${school.name} (${school.lga || 'N/A'})`);
      });
    }
    console.log('\n' + '='.repeat(60) + '\n');

    // Step 5: Test chapters endpoint
    console.log('Step 5: Testing chapters endpoint...');
    const chaptersResponse = await fetch(`${API_BASE_URL}/levy-payments/chapters/postgres`);

    if (!chaptersResponse.ok) {
      throw new Error(`Chapters fetch failed: ${chaptersResponse.status}`);
    }

    const chapters = await chaptersResponse.json();
    console.log(`✅ Chapters fetched successfully! Found ${chapters.length} chapters`);
    console.log('\n' + '='.repeat(60) + '\n');

    console.log('🎉 ALL TESTS PASSED!\n');
    console.log('Summary:');
    console.log('  ✅ Duplicate check working');
    console.log('  ✅ Payment initialization working');
    console.log('  ✅ Payment record created');
    console.log('  ✅ Schools endpoint working');
    console.log('  ✅ Chapters endpoint working');
    console.log('\n📝 Next Steps:');
    console.log('  1. Open the payment URL in a browser to test the Flutterwave modal');
    console.log('  2. Complete a test payment using Flutterwave test cards');
    console.log('  3. Verify the payment callback and status update');
    console.log('\n🔗 Payment URL:', initData.paymentUrl);

    return {
      success: true,
      reference: initData.reference,
      paymentUrl: initData.paymentUrl,
    };
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nError Details:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Run the test
testPaymentInitialization()
  .then((result) => {
    if (!result.success) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
