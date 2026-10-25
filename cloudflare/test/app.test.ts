import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import app from "../src/index.ts";
import { createMemoryD1 } from "./memory-d1.ts";
import type { Bindings } from "../src/env.ts";

const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");
const seed = readFileSync(new URL("../src/db/seed.sql", import.meta.url), "utf8");

const DB = createMemoryD1();
await DB.exec(schema);
await DB.exec(seed);

const env: Bindings = {
  DB,
  JWT_SECRET: "test-secret",
  FRONTEND_URL: "http://localhost:5173",
};

let passed = 0;

function ok(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`  ok ${label}`);
}

async function call(
  path: string,
  init?: { method?: string; body?: unknown; token?: string },
) {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  const response = await app.request(
    `http://localhost${path}`,
    {
      method: init?.method ?? "GET",
      headers,
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    },
    env,
  );
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, json };
}

console.log("\nfees");
const fees = await call("/api/v1/fees/active");
ok("active fees 200", fees.status === 200);
ok("three active fees", fees.json.length === 3);
ok("fees total 11000", fees.json.reduce((s: number, f: any) => s + f.amount, 0) === 11000);

console.log("\nregistration step 1");
const email = `test.${Date.now()}@example.com`;
const phone = `080${String(Date.now()).slice(-8)}`;
const step1 = await call("/api/v1/proprietors/registration/step1", {
  method: "POST",
  body: { firstName: "Test", lastName: "Proprietor", email, phone, lga: "Lafia", sex: "Male" },
});
ok("step1 201", step1.status === 201);
ok("submission id returned", typeof step1.json.submissionId === "string");
const submissionId = step1.json.submissionId;
ok("proprietor _id alias", step1.json.proprietor._id === step1.json.proprietor.id);

console.log("\nregistration step 1 resume");
const resume = await call("/api/v1/proprietors/registration/step1", {
  method: "POST",
  body: { firstName: "Test", lastName: "Proprietor", email, phone, lga: "Lafia" },
});
ok("resume 200", resume.status === 200);
ok("same submission id", resume.json.submissionId === submissionId);

console.log("\nregistration step 2");
const step2 = await call("/api/v1/proprietors/registration/step2", {
  method: "POST",
  body: {
    submissionId,
    schoolName: "Test Academy",
    address: "1 Test Road",
    lga: "Lafia",
    chapter: "Lafia",
    typeOfSchool: "Primary",
    categoryOfSchool: "Private",
  },
});
ok("step2 200", step2.status === 200);
ok("school created", step2.json.school?.schoolName === "Test Academy");
ok("proprietor at step2", step2.json.proprietor.submissionStatus === "step2");

console.log("\nregistration step 3 (mock)");
const step3 = await call("/api/v1/proprietors/registration/step3", {
  method: "POST",
  body: { submissionId, paymentMethod: "mock", finalSubmit: false },
});
ok("step3 200", step3.status === 200);
ok("mock reference", String(step3.json.reference).startsWith("MOCK_"));
ok("amount 11000", step3.json.payment.amount === 11000);
ok("simulation url", String(step3.json.payment.paymentUrl).includes("/payment/simulate?reference="));
const reference = step3.json.reference;

console.log("\nverify pending");
const pending = await call(`/api/v1/payments/verify/${reference}`);
ok("verify 200", pending.status === 200);
ok("status pending", pending.json.status === "pending");
ok("simulated flag", pending.json.simulated === true);
ok("fees returned", pending.json.fees.length === 3);
ok("proprietor name", pending.json.proprietor.firstName === "Test");
ok("school name", pending.json.school.schoolName === "Test Academy");

console.log("\nsimulate");
const simulate = await call("/api/v1/payments/simulate", {
  method: "POST",
  body: { reference, cardNumber: "4242424242424242", cardHolder: "TEST PROPRIETOR" },
});
ok("simulate 200", simulate.status === 200);
ok("payment success", simulate.json.payment.status === "success");
const registrationNumber = simulate.json.payment.registrationNumber;
ok("registration number", String(registrationNumber).startsWith("NAPPS"));

console.log("\nverify success");
const verified = await call(`/api/v1/payments/verify/${reference}`);
ok("status success", verified.json.status === "success");
ok("reg number matches", verified.json.registrationNumber === registrationNumber);
ok("amount 11000", verified.json.amount === 11000);

console.log("\nfinalized proprietor");
const progress = await call(`/api/v1/proprietors/registration/${submissionId}`);
ok("submitted", progress.json.proprietor.submissionStatus === "submitted");
ok("approved", progress.json.proprietor.registrationStatus === "approved");
ok("paid", progress.json.proprietor.paymentStatus === "paid");
ok("cleared", progress.json.proprietor.clearingStatus === "cleared");
ok("due zero", progress.json.proprietor.totalAmountDue === 0);
ok("active", progress.json.proprietor.isActive === true);
ok("history recorded", progress.json.proprietor.duesPaymentHistory.length === 1);
ok(
  "remittance split",
  progress.json.proprietor.duesPaymentHistory[0].remittanceBreakdown.nationalSecretariat25Pct === 2750,
);
ok("currentStep 4", progress.json.currentStep === 4);

console.log("\nidempotent simulate");
const again = await call("/api/v1/payments/simulate", {
  method: "POST",
  body: { reference },
});
ok("already completed", again.json.message === "Payment already completed");

console.log("\nauth");
const badLogin = await call("/api/v1/auth/admin/login", {
  method: "POST",
  body: { email: "admin@napps.ng", password: "wrong" },
});
ok("bad login 401", badLogin.status === 401);
const login = await call("/api/v1/auth/admin/login", {
  method: "POST",
  body: { email: "admin@napps.ng", password: "Admin@1234" },
});
ok("login 200", login.status === 200);
ok("token returned", typeof login.json.access_token === "string");
const token = login.json.access_token;

const noAuth = await call("/api/v1/proprietors/stats");
ok("stats without token 401", noAuth.status === 401);
const stats = await call("/api/v1/proprietors/stats", { token });
ok("stats with token 200", stats.status === 200);
ok("stats total >= 1", stats.json.total >= 1);
ok("stats approved 1", stats.json.byStatus.approved === 1);

const me = await call("/api/v1/auth/profile", { token });
ok("profile 200", me.status === 200);
ok("profile email", me.json.email === "admin@napps.ng");

console.log(`\n${passed} assertions passed`);
