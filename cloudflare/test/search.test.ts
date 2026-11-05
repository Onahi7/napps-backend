import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import app from "../src/index.ts";
import { createMemoryD1 } from "./memory-d1.ts";
import { signJwt } from "../src/lib/auth.ts";

const DB = createMemoryD1();
await DB.exec(readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8"));
const env = { DB, JWT_SECRET: "search-test-secret" };

// Seed admin user for protected routes
const now = new Date().toISOString();
await DB.prepare(`
  INSERT INTO users (id, name, email, password, role, roles, created_at, updated_at)
  VALUES ('admin_1', 'Admin User', 'admin@napps.org', 'fakehash', 'admin', '["admin"]', ?, ?)
`).bind(now, now).run();

const adminToken = await signJwt({ sub: "admin_1", role: "admin", email: "admin@napps.org" }, env.JWT_SECRET);

// Seed Proprietor & School
await DB.prepare(`
  INSERT INTO proprietors (
    id, first_name, last_name, email, phone, registration_number, napps_membership_id,
    submission_status, registration_status, payment_status,
    lga, submission_date, created_at, updated_at
  ) VALUES (
    'prop_1', 'Dickson', 'Hardy', 'DicksonHardy7@gmail.com', '+2348037206952', 'NAPPS/NAS/2026/0042', 'MEM-2026-0042',
    'submitted', 'approved', 'Paid',
    'Keffi', ?, ?, ?
  )
`).bind(now, now, now).run();

await DB.prepare(`
  INSERT INTO schools (
    id, proprietor_id, school_name, category_of_school, type_of_school,
    school_registration_status, total_enrollment, address, lga, chapter,
    created_at, updated_at
  ) VALUES (
    'school_1', 'prop_1', 'Prestige Merit Heritage School', 'Secondary', 'Day',
    'approved', 350, '12 Royalty Way', 'Keffi', 'Keffi Chapter',
    ?, ?
  )
`).bind(now, now).run();

// Link school to proprietor
await DB.prepare("UPDATE proprietors SET school_id = 'school_1' WHERE id = 'prop_1'").run();

// Seed Levy Payments: 1 success, 1 processing
await DB.prepare(`
  INSERT INTO levy_payments (
    id, proprietor_id, member_name, school_name,
    email, phone, chapter, amount, status,
    reference, receipt_number, created_at, updated_at
  ) VALUES
  ('levy_1', 'prop_1', 'Dickson Hardy', 'Prestige Merit Heritage School',
   'dicksonhardy7@gmail.com', '08037206952', 'Keffi Chapter', 5500, 'success',
   'LEVY_REF_12345', 'NAPPS-2026-LEVY-001', ?, ?),
  ('levy_2', 'prop_1', 'Dickson Hardy', 'Prestige Merit Heritage School',
   'dicksonhardy7@gmail.com', '+2348037206952', 'Keffi Chapter', 5500, 'processing',
   'LEVY_REF_99999', 'NAPPS-2026-LEVY-002', ?, ?)
`).bind(now, now, now, now).run();

// Seed Payments (dues/registration)
await DB.prepare(`
  INSERT INTO payments (
    id, proprietor_id, school_id, payment_type, amount, currency, status, payment_method,
    reference, created_at, updated_at
  ) VALUES (
    'pay_1', 'prop_1', 'school_1', 'registration', 11000, 'NGN', 'success', 'card',
    'RCP-2026-0042', ?, ?
  )
`).bind(now, now).run();

console.log("Seeded test data successfully.");

// 1. Test GET /verify-member/:identifier with various formats
console.log("Testing /verify-member/:identifier...");

// By registration number (lowercase)
const verifyRegLower = await app.request("http://localhost/api/v1/proprietors/verify-member/napps%2Fnas%2F2026%2F0042", {}, env);
assert.equal(verifyRegLower.status, 200);
const regData = await verifyRegLower.json() as any;
assert.equal(regData.verified, true);
assert.equal(regData.proprietorName, "Dickson Hardy");
assert.equal(regData.schoolName, "Prestige Merit Heritage School");
assert.equal(regData.lga, "Keffi");
assert.equal(regData.chapter, "Keffi Chapter");
assert.equal(regData.membershipId, "MEM-2026-0042");

// By phone (080 format)
const verifyPhone080 = await app.request("http://localhost/api/v1/proprietors/verify-member/08037206952", {}, env);
assert.equal(verifyPhone080.status, 200);
assert.equal((await verifyPhone080.json() as any).verified, true);

// By phone (+234 format)
const verifyPhone234 = await app.request("http://localhost/api/v1/proprietors/verify-member/%2B2348037206952", {}, env);
assert.equal(verifyPhone234.status, 200);
assert.equal((await verifyPhone234.json() as any).verified, true);

// By email (uppercase)
const verifyEmail = await app.request("http://localhost/api/v1/proprietors/verify-member/DICKSONHARDY7%40GMAIL.COM", {}, env);
assert.equal(verifyEmail.status, 200);
assert.equal((await verifyEmail.json() as any).verified, true);

// By School Name
const verifySchool = await app.request("http://localhost/api/v1/proprietors/verify-member/Prestige%20Merit%20Heritage%20School", {}, env);
assert.equal(verifySchool.status, 200);
assert.equal((await verifySchool.json() as any).verified, true);

// By Receipt Number
const verifyReceipt = await app.request("http://localhost/api/v1/proprietors/verify-member/RCP-2026-0042", {}, env);
assert.equal(verifyReceipt.status, 200);
assert.equal((await verifyReceipt.json() as any).verified, true);

// By Non-existent
const verifyNone = await app.request("http://localhost/api/v1/proprietors/verify-member/NONEXISTENT123", {}, env);
assert.equal(verifyNone.status, 404);

console.log("Passed /verify-member tests.");

// 2. Test GET /levy-payments/by-identifier/:identifier
console.log("Testing /levy-payments/by-identifier/:identifier...");

// By Reference (LEVY_REF_12345)
const levyByRef = await app.request("http://localhost/api/v1/levy-payments/by-identifier/LEVY_REF_12345", {}, env);
assert.equal(levyByRef.status, 200);
const levyRefData = await levyByRef.json() as any[];
assert.equal(levyRefData.length, 1);
assert.equal(levyRefData[0].reference, "LEVY_REF_12345");
assert.equal(levyRefData[0].status, "success");

// By Receipt Number (NAPPS-2026-LEVY-001)
const levyByRcpt = await app.request("http://localhost/api/v1/levy-payments/by-identifier/NAPPS-2026-LEVY-001", {}, env);
assert.equal(levyByRcpt.status, 200);
const levyRcptData = await levyByRcpt.json() as any[];
assert.equal(levyRcptData[0].receiptNumber, "NAPPS-2026-LEVY-001");

// By Email (returns both success and processing)
const levyByEmail = await app.request("http://localhost/api/v1/levy-payments/by-identifier/DICKSONHARDY7%40GMAIL.COM", {}, env);
assert.equal(levyByEmail.status, 200);
const emailLevies = await levyByEmail.json() as any[];
assert.equal(emailLevies.length, 2);
assert.equal(emailLevies[0].status, "success");
assert.equal(emailLevies[1].status, "processing");

// By Phone (+234 format)
const levyByPhone = await app.request("http://localhost/api/v1/levy-payments/by-identifier/%2B2348037206952", {}, env);
assert.equal(levyByPhone.status, 200);
const phoneLevies = await levyByPhone.json() as any[];
assert.equal(phoneLevies.length, 2);

// By School Name
const levyBySchool = await app.request("http://localhost/api/v1/levy-payments/by-identifier/Prestige%20Merit", {}, env);
assert.equal(levyBySchool.status, 200);
const schoolLevies = await levyBySchool.json() as any[];
assert.equal(schoolLevies.length, 2);

console.log("Passed /levy-payments/by-identifier tests.");

// 3. Test GET /levy-payments/schools with search and chapter
console.log("Testing /levy-payments/schools...");

const schoolsSearch = await app.request("http://localhost/api/v1/levy-payments/schools?search=prestige", {}, env);
assert.equal(schoolsSearch.status, 200);
const schoolsSearchData = await schoolsSearch.json() as any[];
assert.equal(schoolsSearchData.length, 1);
assert.equal(schoolsSearchData[0].name, "Prestige Merit Heritage School");

const schoolsChapter = await app.request("http://localhost/api/v1/levy-payments/schools?chapter=keffi", {}, env);
assert.equal(schoolsChapter.status, 200);
const schoolsChapterData = await schoolsChapter.json() as any[];
assert.equal(schoolsChapterData.length, 1);

console.log("Passed /levy-payments/schools tests.");

// 4. Test Admin Search: GET /levy-payments?search=...
console.log("Testing Admin GET /levy-payments?search=...");

const adminLevySearchRef = await app.request("http://localhost/api/v1/levy-payments?search=LEVY_REF_12345", {
  headers: { Authorization: `Bearer ${adminToken}` }
}, env);
assert.equal(adminLevySearchRef.status, 200);
assert.equal((await adminLevySearchRef.json() as any).data.length, 1);

const adminLevySearchName = await app.request("http://localhost/api/v1/levy-payments?search=Hardy", {
  headers: { Authorization: `Bearer ${adminToken}` }
}, env);
assert.equal(adminLevySearchName.status, 200);
assert.equal((await adminLevySearchName.json() as any).data.length, 2);

console.log("Passed Admin /levy-payments?search= tests.");

// 5. Test Admin Search: GET /proprietors?search=... matching school name
console.log("Testing Admin GET /proprietors?search=...");

const adminPropSearchSchool = await app.request("http://localhost/api/v1/proprietors?search=Heritage", {
  headers: { Authorization: `Bearer ${adminToken}` }
}, env);
assert.equal(adminPropSearchSchool.status, 200);
const propList = (await adminPropSearchSchool.json() as any).data;
assert.equal(propList.length, 1);
assert.equal(propList[0].id, "prop_1");

console.log("Passed Admin /proprietors?search= tests.");

// 6. Test Admin Search: GET /payments?search=...
console.log("Testing Admin GET /payments?search=...");

const adminPaySearch = await app.request("http://localhost/api/v1/payments?search=RCP-2026-0042", {
  headers: { Authorization: `Bearer ${adminToken}` }
}, env);
assert.equal(adminPaySearch.status, 200);
const payList = (await adminPaySearch.json() as any).data;
assert.equal(payList.length, 1);
assert.equal(payList[0].id, "pay_1");

console.log("Passed Admin /payments?search= tests.");
console.log("\nALL SEARCH & LOOKUP TESTS PASSED SUCCESSFULLY! 🎉\n");
