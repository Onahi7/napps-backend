import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import app from "../src/index.ts";
import { createMemoryD1 } from "./memory-d1.ts";

const DB = createMemoryD1();
await DB.exec(readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8"));
const env = { DB, JWT_SECRET: "registration-test-secret" };
async function request(path: string, body?: unknown) {
  const response = await app.request(`http://localhost/api/v1/proprietors${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }, env);
  return { status: response.status, data: await response.json() as any };
}
const personal = { firstName: "Test", lastName: "Owner", email: "test@example.com", phone: "+234 (801) 234-5678" };
const declarations = ["national", "state", "zonal"].map(level => ({ sessionId: "2026/2027", level, paid: true }));
const created = await request("/registration/step1", { ...personal, duesDeclarations: declarations });
assert.equal(created.status, 201);
const id = created.data.proprietor.id;
const submissionId = created.data.submissionId;
assert.deepEqual(created.data.proprietor.duesDeclarations, declarations);
assert.deepEqual(created.data.proprietor.duesPaymentHistory, []);
assert.notEqual(created.data.proprietor.paymentStatus, "Paid");

for (const phone of ["08012345678", "+2348012345678", "2348012345678", "8012345678", "0801 234 5678"]) {
  for (const query of ["phone", "search"]) {
    const found = await request(`/lookup?${query}=${encodeURIComponent(phone)}`);
    assert.equal(found.status, 200);
    assert.equal(found.data.length, 1);
    assert.equal(found.data[0].id, id);
  }
  const resumed = await request("/registration/step1", { ...personal, phone });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.data.submissionId, submissionId);
}
const emptyPhone = await request("/lookup?phone=9999999999");
assert.deepEqual(emptyPhone.data, []);
const count = await DB.prepare("SELECT count(*) AS total FROM proprietors").first<{total: number}>();
assert.equal(count?.total, 1);

for (const totalEnrollment of [undefined, "", null, 0, 350]) {
  const saved = await request("/registration/step2", { submissionId, schoolName: "Test Academy", address: "1 Test Road", totalEnrollment });
  assert.equal(saved.status, 200);
  if (typeof totalEnrollment === "number") assert.equal(saved.data.school.totalEnrollment, totalEnrollment);
}
for (const totalEnrollment of [-1, "invalid", 1.5]) {
  assert.equal((await request("/registration/step2", { submissionId, schoolName: "Test Academy", address: "1 Test Road", totalEnrollment })).status, 400);
}
const lookup = await request("/lookup?phone=08012345678");
assert.equal(lookup.data[0].totalEnrollment, 350);
for (const query of ["schoolName=Test%20Academy", "search=Test%20Academy", "search=Test"]) {
  const found = await request(`/lookup?${query}`);
  assert.equal(found.status, 200);
  assert.equal(found.data[0].id, id);
}
const progress = await request(`/registration/${submissionId}`);
assert.deepEqual(progress.data.proprietor.duesDeclarations, declarations);
assert.equal(progress.data.currentStep, 3);
const resumedStep2 = await request("/registration/step1", personal);
assert.equal(resumedStep2.data.proprietor.submissionStatus, "step2");
assert.equal((await request("/registration/step1", { ...personal, duesDeclarations: [{ sessionId: "2026/2027", level: "unknown", paid: true }] })).status, 400);

await DB.prepare("UPDATE proprietors SET submission_status = 'submitted', registration_status = 'approved' WHERE id = ?").bind(id).run();
const conflict = await request("/registration/step1", { ...personal, email: "other@example.com", phone: "+2348012345678" });
assert.equal(conflict.status, 409);
assert.equal((await request("/lookup?phone=08012345678")).data[0].id, id);
const renewal = await request("/renewal/status/08012345678");
assert.equal(renewal.status, 200);
assert.equal(renewal.data.proprietor.id, id);

// Legacy records can share a phone. Never pick one arbitrarily or overwrite it.
await DB.prepare("INSERT INTO proprietors (id,first_name,last_name,email,phone,submission_date,created_at,updated_at) VALUES ('legacy','Legacy','Owner','legacy@example.com','08012345678','2026','2026','2026')").run();
assert.equal((await request("/lookup?phone=2348012345678")).data.length, 2);
assert.equal((await request("/registration/step1", { ...personal, email: "third@example.com" })).status, 409);
console.log("Registration regressions passed: phone formats, duplicates, optional enrollment, persistence, dues declarations, and renewal lookup.");
