# Cloudflare production backend

The active portal backend is `cloudflare/`: Hono on Cloudflare Workers, D1 database `napps`, and R2 uploads. The NestJS application at the repository root is retained for legacy reference.

From this directory run `npm ci`, `npm test`, and `npm run typecheck`.

For an existing database that predates the registration fields, apply `src/db/patch-registration-fields.sql` once with `wrangler d1 execute napps --remote --file=src/db/patch-registration-fields.sql`, then deploy with `npm run deploy`. Inspect `pragma_table_info` first; fresh databases created from `schema.sql` already have these columns. Never run the seed script against production.

The portal uses `https://napps-backend.dicksonhardy7.workers.dev/api/v1`. The separate `napps-api` Worker is a legacy proxy to Render and must not be used for registration or lookup.

Registration fixes:
- The same normalized phone identity is used for duplicate checks, lookup, and renewal lookup. Nigerian local, international, and ten-digit formats resolve consistently. Existing ambiguous phone matches return a conflict without merging records.
- Blank enrollment values are optional; valid counts, including zero, persist in `schools.total_enrollment`.
- National, State, and Zonal dues declarations are stored separately in `proprietors.dues_declarations`. They are self-reported and do not approve payment, create a payment ledger entry, or reduce fees.

Deployment requires the existing Worker secrets and bindings. Do not commit credentials, local `.wrangler` state, or production data.
