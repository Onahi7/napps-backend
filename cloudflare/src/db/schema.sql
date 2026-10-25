-- NAPPS Nasarawa API - D1 schema
-- All ids are UUID TEXT. Mongo ObjectIds are preserved during migration by
-- reusing the 24-char hex string as the id.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  password TEXT,
  image TEXT,
  roles TEXT NOT NULL DEFAULT '["user"]',
  role TEXT DEFAULT 'user',
  app_access TEXT NOT NULL DEFAULT '["connect_hub","portal"]',
  is_active INTEGER NOT NULL DEFAULT 1,
  is_email_verified INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  external_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE TABLE IF NOT EXISTS proprietors (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  sex TEXT,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  lga TEXT,
  passport_photo TEXT,
  times_participated INTEGER,
  registration_number TEXT,
  napps_membership_id TEXT,
  school_id TEXT REFERENCES schools(id) ON DELETE SET NULL,
  registration_status TEXT NOT NULL DEFAULT 'pending',
  approval_status TEXT DEFAULT 'pending',
  napps_registered TEXT NOT NULL DEFAULT 'Not Registered',
  participation_history TEXT DEFAULT '[]',
  dues_declarations TEXT NOT NULL DEFAULT '[]',
  awards TEXT,
  position_held TEXT,
  position_in_napps TEXT,
  school_code TEXT,
  has_napps_id_card INTEGER NOT NULL DEFAULT 0,
  nnsuce_times_written TEXT DEFAULT 'Never',
  nnsuce2025_pupils_count INTEGER NOT NULL DEFAULT 0,
  dues_payment_history TEXT NOT NULL DEFAULT '[]',
  payment_evidence TEXT NOT NULL DEFAULT '[]',
  clearing_status TEXT NOT NULL DEFAULT 'pending',
  total_amount_due REAL NOT NULL DEFAULT 0,
  last_payment_date TEXT,
  last_renewed_session TEXT,
  submission_id TEXT,
  submission_date TEXT NOT NULL,
  submission_status TEXT NOT NULL DEFAULT 'draft',
  is_active INTEGER NOT NULL DEFAULT 1,
  payment_status TEXT DEFAULT 'Not Paid',
  payment_method TEXT DEFAULT 'mock',
  approval_evidence TEXT,
  reference TEXT,
  pupils_presented_last_exam INTEGER,
  chapters TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proprietors_email ON proprietors(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proprietors_regno ON proprietors(registration_number) WHERE registration_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_proprietors_membership ON proprietors(napps_membership_id) WHERE napps_membership_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_proprietors_submission ON proprietors(submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proprietors_phone ON proprietors(phone);
CREATE INDEX IF NOT EXISTS idx_proprietors_school ON proprietors(school_id);
CREATE INDEX IF NOT EXISTS idx_proprietors_status ON proprietors(registration_status);
CREATE INDEX IF NOT EXISTS idx_proprietors_clearing ON proprietors(clearing_status);
CREATE INDEX IF NOT EXISTS idx_proprietors_active ON proprietors(is_active);

CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  proprietor_id TEXT NOT NULL,
  school_name TEXT NOT NULL,
  school_name2 TEXT,
  address TEXT NOT NULL,
  address_line2 TEXT,
  lga TEXT,
  chapter TEXT,
  aege_lgea_da TEXT,
  school_registration_status TEXT DEFAULT 'IN PROGRESS',
  levels_of_education TEXT,
  school_code TEXT,
  phone TEXT,
  aeqeo_zone TEXT,
  year_of_establishment INTEGER,
  year_of_approval INTEGER,
  type_of_school TEXT,
  category_of_school TEXT NOT NULL DEFAULT 'Private',
  ownership TEXT,
  gps_longitude REAL,
  gps_latitude REAL,
  registration_evidence TEXT,
  registration_evidence_photo TEXT,
  cac_number TEXT,
  moe_registration_number TEXT,
  nnsuce_times_written TEXT,
  nnsuce_pupils_count INTEGER,
  enrollment TEXT DEFAULT '{}',
  total_enrollment INTEGER,
  is_primary INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  images TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schools_proprietor ON schools(proprietor_id);
CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(school_name);
CREATE INDEX IF NOT EXISTS idx_schools_chapter ON schools(chapter);

CREATE TABLE IF NOT EXISTS fees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  amount REAL NOT NULL CHECK (amount >= 0),
  description TEXT,
  fee_structure TEXT DEFAULT '{}',
  paystack_split_code TEXT,
  split_code_description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurring_interval TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'required',
  minimum_amount REAL NOT NULL DEFAULT 0,
  maximum_amount REAL,
  allow_partial_payment INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  valid_from TEXT,
  valid_until TEXT,
  last_modified_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fees_name_lower ON fees(lower(name));
CREATE INDEX IF NOT EXISTS idx_fees_code ON fees(code);
CREATE INDEX IF NOT EXISTS idx_fees_active ON fees(is_active);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  proprietor_id TEXT,
  school_id TEXT,
  payment_type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT NOT NULL DEFAULT 'mock',
  gateway TEXT DEFAULT 'mock',
  paystack_channel TEXT,
  gateway_response TEXT,
  paystack_reference TEXT,
  reference TEXT,
  account_generation_id TEXT,
  account_number TEXT,
  account_name TEXT,
  bank_name TEXT DEFAULT 'Fidelity Bank',
  virtual_account TEXT,
  transaction_id TEXT,
  paystack_transaction_id TEXT,
  gateway_transaction_id TEXT,
  bank_reference TEXT,
  settled_amount REAL,
  fee_amount REAL,
  vat_amount REAL,
  sender_account_number TEXT,
  sender_account_name TEXT,
  sender_bank_name TEXT,
  narration TEXT,
  session_id TEXT,
  expiry_time TEXT,
  payment_date TEXT,
  paid_at TEXT,
  due_date TEXT,
  description TEXT,
  email TEXT,
  webhook_received INTEGER NOT NULL DEFAULT 0,
  webhook_data TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  split_code TEXT,
  paystack_split_code TEXT,
  split_config TEXT,
  fee_breakdown TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference) WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_paystack_ref ON payments(paystack_reference) WHERE paystack_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_proprietor ON payments(proprietor_id);
CREATE INDEX IF NOT EXISTS idx_payments_school ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(account_generation_id);

CREATE TABLE IF NOT EXISTS levy_payments (
  id TEXT PRIMARY KEY,
  proprietor_id TEXT,
  member_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  chapter TEXT NOT NULL,
  school_name TEXT NOT NULL,
  is_manual_school_entry INTEGER NOT NULL DEFAULT 0,
  wards TEXT NOT NULL DEFAULT '[]',
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reference TEXT NOT NULL UNIQUE,
  flutterwave_transaction_id TEXT,
  flutterwave_payment_id TEXT,
  payment_url TEXT,
  payment_method TEXT NOT NULL DEFAULT 'other',
  gateway_response TEXT,
  paid_at TEXT,
  failure_reason TEXT,
  receipt_url TEXT,
  receipt_number TEXT,
  metadata TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  previous_payment_reference TEXT,
  is_continuation INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_levy_proprietor ON levy_payments(proprietor_id);
CREATE INDEX IF NOT EXISTS idx_levy_email ON levy_payments(email);
CREATE INDEX IF NOT EXISTS idx_levy_phone ON levy_payments(phone);
CREATE INDEX IF NOT EXISTS idx_levy_status ON levy_payments(status);
CREATE INDEX IF NOT EXISTS idx_levy_chapter ON levy_payments(chapter);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  proprietor_id TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  term TEXT NOT NULL,
  enrollment_by_level TEXT DEFAULT '{}',
  gender_breakdown TEXT DEFAULT '{}',
  staff_data TEXT DEFAULT '{}',
  total_enrollment INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TEXT,
  verified_at TEXT,
  verified_by TEXT,
  remarks TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_unique ON enrollments(school_id, academic_year, term);
CREATE INDEX IF NOT EXISTS idx_enrollments_proprietor ON enrollments(proprietor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);

CREATE TABLE IF NOT EXISTS school_enrollments (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2024/2025',
  nursery1_male INTEGER NOT NULL DEFAULT 0,
  nursery1_female INTEGER NOT NULL DEFAULT 0,
  nursery2_male INTEGER NOT NULL DEFAULT 0,
  nursery2_female INTEGER NOT NULL DEFAULT 0,
  nursery3_male INTEGER NOT NULL DEFAULT 0,
  nursery3_female INTEGER NOT NULL DEFAULT 0,
  kg1_male INTEGER NOT NULL DEFAULT 0,
  kg1_female INTEGER NOT NULL DEFAULT 0,
  kg2_male INTEGER NOT NULL DEFAULT 0,
  kg2_female INTEGER NOT NULL DEFAULT 0,
  primary1_male INTEGER NOT NULL DEFAULT 0,
  primary1_female INTEGER NOT NULL DEFAULT 0,
  primary2_male INTEGER NOT NULL DEFAULT 0,
  primary2_female INTEGER NOT NULL DEFAULT 0,
  primary3_male INTEGER NOT NULL DEFAULT 0,
  primary3_female INTEGER NOT NULL DEFAULT 0,
  primary4_male INTEGER NOT NULL DEFAULT 0,
  primary4_female INTEGER NOT NULL DEFAULT 0,
  primary5_male INTEGER NOT NULL DEFAULT 0,
  primary5_female INTEGER NOT NULL DEFAULT 0,
  primary6_male INTEGER NOT NULL DEFAULT 0,
  primary6_female INTEGER NOT NULL DEFAULT 0,
  jss1_male INTEGER NOT NULL DEFAULT 0,
  jss1_female INTEGER NOT NULL DEFAULT 0,
  jss2_male INTEGER NOT NULL DEFAULT 0,
  jss2_female INTEGER NOT NULL DEFAULT 0,
  jss3_male INTEGER NOT NULL DEFAULT 0,
  jss3_female INTEGER NOT NULL DEFAULT 0,
  ss1_male INTEGER NOT NULL DEFAULT 0,
  ss1_female INTEGER NOT NULL DEFAULT 0,
  ss2_male INTEGER NOT NULL DEFAULT 0,
  ss2_female INTEGER NOT NULL DEFAULT 0,
  ss3_male INTEGER NOT NULL DEFAULT 0,
  ss3_female INTEGER NOT NULL DEFAULT 0,
  pupils_presented2023 INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_enrollments_unique ON school_enrollments(school_id, academic_year);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_active INTEGER NOT NULL DEFAULT 1,
  show_on_all_pages INTEGER NOT NULL DEFAULT 0,
  show_on_portal INTEGER NOT NULL DEFAULT 0,
  background_color TEXT NOT NULL DEFAULT '#1e40af',
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  start_date TEXT,
  end_date TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  app_scope TEXT NOT NULL DEFAULT 'both',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  email TEXT,
  phone TEXT,
  social_media TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_members_order ON members(display_order);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  position TEXT NOT NULL,
  department TEXT,
  bio TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  profile_image_url TEXT,
  profile_image_public_id TEXT,
  category TEXT NOT NULL DEFAULT 'staff',
  role TEXT NOT NULL DEFAULT 'member',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  joined_date TEXT,
  achievements TEXT DEFAULT '[]',
  qualifications TEXT DEFAULT '[]',
  years_of_experience INTEGER,
  specialization TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_team_category ON team_members(category);
CREATE INDEX IF NOT EXISTS idx_team_active ON team_members(is_active);

CREATE TABLE IF NOT EXISTS hero_images (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  button_text TEXT,
  button_link TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS homepage_content (
  id TEXT PRIMARY KEY,
  content_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT,
  description TEXT,
  image_url TEXT,
  image_public_id TEXT,
  gallery_urls TEXT DEFAULT '[]',
  gallery_public_ids TEXT DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_homepage_key ON homepage_content(content_key);

CREATE TABLE IF NOT EXISTS page_content (
  id TEXT PRIMARY KEY,
  page_name TEXT NOT NULL,
  section_name TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_page_content_unique ON page_content(page_name, section_name);

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type TEXT NOT NULL DEFAULT 'text',
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_settings_public ON site_settings(is_public);

CREATE TABLE IF NOT EXISTS nnsuce_centers (
  id TEXT PRIMARY KEY,
  center_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  lga TEXT NOT NULL,
  address TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 250,
  supervisor_name TEXT NOT NULL,
  supervisor_phone TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nnsuce_centers_lga ON nnsuce_centers(lga);

CREATE TABLE IF NOT EXISTS nnsuce_candidates (
  id TEXT PRIMARY KEY,
  exam_number TEXT NOT NULL UNIQUE,
  candidate_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  school_name TEXT NOT NULL,
  school_id TEXT,
  center_code TEXT NOT NULL,
  passport_photo TEXT,
  subjects TEXT DEFAULT '[]',
  security_token TEXT NOT NULL,
  academic_session TEXT NOT NULL DEFAULT '2025/2026',
  status TEXT NOT NULL DEFAULT 'registered',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nnsuce_candidates_center ON nnsuce_candidates(center_code);
CREATE INDEX IF NOT EXISTS idx_nnsuce_candidates_school ON nnsuce_candidates(school_name);

CREATE TABLE IF NOT EXISTS nnsuce_results (
  id TEXT PRIMARY KEY,
  exam_number TEXT NOT NULL UNIQUE,
  candidate_name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  center_code TEXT NOT NULL,
  subject_scores TEXT NOT NULL DEFAULT '{}',
  total_score INTEGER NOT NULL DEFAULT 0,
  average_percentage INTEGER NOT NULL DEFAULT 0,
  overall_grade TEXT NOT NULL DEFAULT 'Pass',
  omr_audit_data TEXT,
  academic_session TEXT NOT NULL DEFAULT '2025/2026',
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nnsuce_results_center ON nnsuce_results(center_code);
CREATE INDEX IF NOT EXISTS idx_nnsuce_results_school ON nnsuce_results(school_name);
