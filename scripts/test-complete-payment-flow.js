/**
 * Complete Payment Flow Test with Test Data
 * Tests the entire levy payment process from initialization to verification
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

// Test data - using unique identifiers for each test run
const timestamp = Date.now();
const testData = {
  memberName: 'John Doe Test',
  email: `test.payment.${timestamp}@example.com`,
  phone: `080${Math.floor(10000000 + Math.random() * 90000000)}`,
  chapter: 'Lafia A',
  schoolName: 'Test International School',
  isManualSchoolEntry: true,
  wards: ['Ward A', 'Ward B', 'Ward C'],
  amount: 5500,
};

console.log('🧪 NAPPS LEVY PAYMENT - COMPLETE FLOW TEST');
console.log('='.repeat(70));
console.log('\n📋 Test Data:');
console.log(JSON.stringify(testData, null, 2));
console.log('\n' + '='.repeat(70) + '\n');

let paymentReference = null;
let receiptNumber = null;
let paymentUrl = null;

/**
 * Step 1: Check for duplicate email/phone
 */
async function step1_checkDuplicate() {
  console.log('📍 STEP 1: Checking for Duplicate Email/Phone');
  console.log('-'.repeat(70));

  try {
    const response = await fetch(`${API_BASE_URL}/levy-payments/check-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testData.email,
        phone: testData.phone,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Duplicate Check Result:');
    console.log(`   - Is Duplicate: ${result.isDuplicate}`);
    
    if (result.isDuplicate) {
      console.log(`   - Can Continue: ${result.canContinue}`);
      console.log(`   - Existing Payment Status: ${result.payment?.status}`);
      
      if (!result.canContinue) {
        console.log('\n⚠️  WARNING: Payment already completed with this email/phone');
        return false;
      }
    } else {
      console.log('   - No existing payment found');
    }

    console.log('\n✅ Step 1 Passed\n');
    return true;

  } catch (error) {
    console.error('❌ Step 1 Failed:', error.message);
    throw error;
  }
}

/**
 * Step 2: Fetch available schools for the chapter
 */
async function step2_fetchSchools() {
  console.log('📍 STEP 2: Fetching Schools for Chapter');
  console.log('-'.repeat(70));

  try {
    const response = await fetch(
      `${API_BASE_URL}/levy-payments/schools/postgres?chapter=${encodeURIComponent(testData.chapter)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const schools = await response.json();
    
    console.log(`✅ Found ${schools.length} schools in "${testData.chapter}" chapter`);
    
    if (schools.length > 0) {
      console.log('\n   Sample Schools:');
      schools.slice(0, 5).forEach((school, idx) => {
        console.log(`   ${idx + 1}. ${school.name}`);
      });
    } else {
      console.log('   ℹ️  No schools found - will use manual entry');
    }

    console.log('\n✅ Step 2 Passed\n');
    return schools;

  } catch (error) {
    console.error('❌ Step 2 Failed:', error.message);
    console.log('   ℹ️  Continuing with manual school entry...\n');
    return [];
  }
}

/**
 * Step 3: Initialize payment
 */
async function step3_initializePayment() {
  console.log('📍 STEP 3: Initializing Payment');
  console.log('-'.repeat(70));

  try {
    const response = await fetch(`${API_BASE_URL}/levy-payments/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    
    paymentReference = result.reference;
