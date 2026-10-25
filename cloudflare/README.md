# NAPPS Backend — Cloudflare Workers

Free-tier rewrite of the NestJS/MongoDB backend using **Hono + D1 (SQLite) + R2**.
Runs inside Cloudflare's free plan: 100k requests/day, 10 ms CPU/request,
D1 5 GB storage / 5M reads/day, R2 10 GB with free egress.

## Status

Ported and tested end-to-end:

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/admin/login`, `/auth/login`, `/auth/register`, `GET /auth/profile`, `GET /auth/me`, `POST /auth/change-password` |
| Fees | `GET /fees`, `/fees/active`, `/fees/stats`, `/fees/:id`; `POST /fees`; `PUT/PATCH /fees/:id`; `DELETE /fees/:id` |
| Proprietors | 3-step registration (`step1`, `step2`, `step3`), `GET registration/:submissionId`, `lookup`, list/pagination, `stats`, `:id`, `:id/payment`, `:id/enrollment`, `:id/chapters`, `chapters/available`, `chapters/bulk-update`, `verify-member/:identifier`, validation form |
| Payments | `POST /payments/simulate` (auto-finalizes + approves), `GET /payments/verify/:reference` (public), `GET /payments/fidelity/status/:reference`, `POST /payments/initiate-lookup-payment`, `POST /payments/webhook`, list/stats |

Still on the old backend (not ported yet): levy payments, NNSUCE/OMR, connect-hub,
announcements/hero/homepage/page-content/site-settings CRUD, CSV import, id-card
and receipt PDFs (keep PDF generation in the browser), file uploads.

## Local development

```bash
npm install
npx wrangler d1 create napps          # copy the database_id into wrangler.toml
npm run db:schema:local
npm run db:seed:local
npm run dev                            # http://localhost:8787/api/v1
npm test                               # 46 assertions, in-memory SQLite
```

Default admin from the seed: `admin@napps.ng` / `Admin@1234` — change it immediately.

## Deploy

```bash
npx wrangler login
npx wrangler d1 create napps
# put the returned database_id in wrangler.toml
npm run db:schema:remote
npm run db:seed:remote
npx wrangler secret put JWT_SECRET      # long random string
npx wrangler secret put RESEND_API_KEY  # optional, enables email
npx wrangler secret put EMAIL_FROM      # e.g. "NADSS <noreply@nappsnasarawa.com>"
npm run deploy
```

Then point the portal at it:

```
VITE_API_BASE_URL=https://napps-backend.<account>.workers.dev/api/v1
```

Add a custom domain (`api.nappsnasarawa.com`) in the Cloudflare dashboard and add
that origin to `ALLOWED_ORIGINS` in `wrangler.toml`.

## Migrating existing MongoDB data

```bash
MONGO_URI="mongodb+srv://..." MONGO_DB=napps npm run migrate:mongo
npx wrangler d1 execute napps --remote --file=./migration.sql
```

The script reads the live schema from `src/db/schema.sql`, maps camelCase fields to
snake_case columns, stringifies embedded objects, converts ObjectIds and dates, and
emits idempotent `INSERT OR IGNORE` statements. Re-running is safe.

**Passwords:** Mongo stores bcrypt hashes, which Workers cannot verify within the
10 ms CPU budget. Users imported from Mongo must reset their password (or you can
set new PBKDF2 hashes before importing). The seeded admin uses PBKDF2.

## Notes

- Free plan CPU cap is 10 ms/request. D1 I/O doesn't count toward it, but heavy
  crypto does — hence PBKDF2 at 25k iterations and no server-side PDF rendering.
- `_id` is included alongside `id` on every response for portal compatibility.
- All money in `payments.amount` is stored in **kobo**; API responses divide by 100.
