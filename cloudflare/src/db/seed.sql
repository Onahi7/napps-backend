-- Seed data for local development and first deploy.
-- Admin login: admin@napps.ng / Admin@1234  (change immediately after first login)

INSERT OR IGNORE INTO users (
  id, email, name, first_name, last_name, password, role, roles, app_access,
  is_active, created_at, updated_at
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'admin@napps.ng',
  'NADSS Admin',
  'NADSS',
  'Admin',
  'pbkdf2$25000$IGQ4aFDwbCison4QoE6I3w$k5hcaJKXM8fyJ0ZruMEparGAaOF8Ch_Jj4AgShEy6SQ',
  'super_admin',
  '["super_admin","admin"]',
  '[]',
  1,
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO fees (id, name, code, amount, description, is_active, created_at, updated_at)
VALUES
  ('22222222-2222-4222-8222-222222222221', 'National Dues', 'NATIONAL', 5000, 'National secretariat annual dues', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('22222222-2222-4222-8222-222222222222', 'State Dues', 'STATE', 4000, 'State chapter annual dues', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('22222222-2222-4222-8222-222222222223', 'Zonal Dues', 'ZONAL', 2000, 'Zonal chapter annual dues', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO nnsuce_centers (
  id, center_code, name, lga, address, capacity, supervisor_name, supervisor_phone,
  is_active, created_at, updated_at
) VALUES
  ('33333333-3333-4333-8333-333333333331', 'NAS-C01', 'Lafia Central Examination Center', 'Lafia', 'Shendam Road, Lafia', 350, 'Zonal Exam Supervisor', '', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('33333333-3333-4333-8333-333333333332', 'NAS-C02', 'Karu Examination Center', 'Karu', 'Nyanya-Mararaba Express, Karu', 400, 'Zonal Exam Supervisor', '', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('33333333-3333-4333-8333-333333333333', 'NAS-C03', 'Keffi Zonal Examination Center', 'Keffi', 'Along Akwanga Road, Keffi', 300, 'Zonal Exam Supervisor', '', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('33333333-3333-4333-8333-333333333334', 'NAS-C04', 'Akwanga Examination Center', 'Akwanga', 'Jos Road, Akwanga', 250, 'Zonal Exam Supervisor', '', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('33333333-3333-4333-8333-333333333335', 'NAS-C05', 'Doma Examination Center', 'Doma', 'Palace Way, Doma', 200, 'Zonal Exam Supervisor', '', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
