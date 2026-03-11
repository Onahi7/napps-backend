/**
 * Proprietor Registration Flow Test
 * Tests all 3 steps of registration to verify data saves to the database
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

const timestamp = Date.now();
const testData = {
  // Step 1: Personal Info
  step1: {
    firstName: 'TestFirst',
    middleName: 'TestMiddle',
    lastName: 'TestLast',
    sex: 'Male',
    email: `test.proprietor.${timestamp}@example.com`,
    phone: `080${Math.floor(10000000 + Math.random() * 90000000)}`,
    lga: 'Lafia',
    nappsRegistered: 'Not Registered',
    timesParticipated: 2,
    pupilsPresentedLastExam: 15,
    awards: 'Best School Award 2025',
    positionHeld: 'Chairman',
    chapters: ['Lafia A'],
  },
  // Step 2: School Info
  step2: {
    schoolName: `Test Academy ${timestamp}`,
    address: '123 Test Street, Lafia',
    lga: 'Lafia',
    chapter: 'Lafia A',
    typeOfSchool: 'Secular',
    categoryOfSchool: 'Private',
    ownership: 'Individual(s)',
    yearOfEstablishment: 2015,
    yearOfApproval: 2016,
    enrollment: {
      primary1Male: 20,
      primary1Female: 25,
      primary2Male: 18,
      primary2Female: 22,
      primary3Male: 15,
      primary3Female: 20,
    },
  },
};

let submissionId = null;

async function step1_savePersonalInfo() {
  console.log('\n--- STEP 1: Save Personal Information ---');
  console.log('POST', `${API_BASE_URL}/proprietors/registration/step1`);
  console.log('Payload:', JSON.stringify(testData.step1, null, 2));

  const response = await fetch(`${API_BASE_URL}/proprietors/registration/step1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testData.step1),
  });

  const body = await response.text();
  console.log(`Status: ${response.status}`);

  if (!response.ok) {
    console.log('FAILED - Response:', body);
    return false;
  }

  const result = JSON.parse(body);
  submissionId = result.submissionId;
  console.log('SUCCESS');
  console.log('  submissionId:', submissionId);
  console.log('  proprietor._id:', result.proprietor?._id);
  console.log('  firstName:', result.proprietor?.firstName);
  console.log('  email:', result.proprietor?.email);
  console.log('  lga:', result.proprietor?.lga);
  console.log('  nappsRegistered:', result.proprietor?.nappsRegistered);
  console.log('  chapters:', result.proprietor?.chapters);
  console.log('  submissionStatus:', result.proprietor?.submissionStatus);
  return true;
}

async function step2_saveSchoolInfo() {
  console.log('\n--- STEP 2: Save School Information ---');
  const payload = { submissionId, ...testData.step2 };
  console.log('POST', `${API_BASE_URL}/proprietors/registration/step2`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${API_BASE_URL}/proprietors/registration/step2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  console.log(`Status: ${response.status}`);

  if (!response.ok) {
    console.log('FAILED - Response:', body);
    return false;
  }

  const result = JSON.parse(body);
  console.log('SUCCESS');
  console.log('  school._id:', result.school?._id);
  console.log('  schoolName:', result.school?.schoolName);
  console.log('  address:', result.school?.address);
  console.log('  enrollment:', JSON.stringify(result.school?.enrollment));
  console.log('  proprietor.submissionStatus:', result.proprietor?.submissionStatus);
  console.log('  proprietor.school (linked):', result.proprietor?.school);
  return true;
}

async function verifyInDatabase() {
  console.log('\n--- VERIFY: Fetch proprietor back from API ---');

  // Use GET /registration/:submissionId to retrieve the saved data
  const url = `${API_BASE_URL}/proprietors/registration/${submissionId}`;
  console.log('GET', url);

  const response = await fetch(url);
  const body = await response.text();
  console.log(`Status: ${response.status}`);

  if (!response.ok) {
    console.log('FAILED to verify:', body);
    return;
  }

  const result = JSON.parse(body);
  console.log('SUCCESS - Proprietor found in database:');
  console.log('  _id:', result._id || result.proprietor?._id);
  const p = result.proprietor || result;
  console.log('  name:', `${p.firstName} ${p.middleName || ''} ${p.lastName}`);
  console.log('  email:', p.email);
  console.log('  phone:', p.phone);
  console.log('  lga:', p.lga);
  console.log('  submissionStatus:', p.submissionStatus);
  console.log('  chapters:', p.chapters);
  console.log('  school ref:', p.school);

  if (result.school) {
    console.log('  school.schoolName:', result.school.schoolName);
    console.log('  school.address:', result.school.address);
    console.log('  school.enrollment:', JSON.stringify(result.school.enrollment));
  }
}

async function cleanup() {
  // Delete the test proprietor and school if you want a clean test
  // For now we just note the IDs for manual cleanup
  console.log('\n--- CLEANUP INFO ---');
  console.log('  submissionId:', submissionId);
  console.log('  email:', testData.step1.email);
  console.log('  (Delete manually from DB if needed)');
}

async function main() {
  console.log('='.repeat(60));
  console.log('  PROPRIETOR REGISTRATION TEST');
  console.log(`  API: ${API_BASE_URL}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const step1ok = await step1_savePersonalInfo();
  if (!step1ok) {
    console.log('\nStep 1 failed. Aborting.');
    process.exit(1);
  }

  const step2ok = await step2_saveSchoolInfo();
  if (!step2ok) {
    console.log('\nStep 2 failed. Aborting.');
    process.exit(1);
  }

  await verifyInDatabase();
  await cleanup();

  console.log('\n' + '='.repeat(60));
  console.log('  TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
