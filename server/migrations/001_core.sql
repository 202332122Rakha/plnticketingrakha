-- PostgreSQL schema. Operational flags retain 0/1 for the existing API contract.

CREATE TABLE IF NOT EXISTS units (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  legacy_key VARCHAR(100) UNIQUE,
  unit_code VARCHAR(50) NOT NULL,
  unit_name VARCHAR(255) NOT NULL,
  unit_type VARCHAR(50) CHECK (unit_type IN ('UPDL','CORPU','NON_UPDL')) NOT NULL,
  unit_region VARCHAR(100) NOT NULL DEFAULT 'Non-UPDL',
  unit_focus TEXT,
  is_active SMALLINT CHECK (is_active IN (0,1)) NOT NULL DEFAULT 1,
  requires_verification SMALLINT CHECK (requires_verification IN (0,1)) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  employee_number VARCHAR(100) UNIQUE,
  role VARCHAR(50) CHECK (role IN ('admin','manajemen','pelapor','pic')) NOT NULL,
  unit_id VARCHAR(36),
  account_status VARCHAR(50) CHECK (account_status IN ('pending','active','suspended','rejected','disabled')) NOT NULL DEFAULT 'pending',
  registration_status VARCHAR(50) CHECK (registration_status IN ('pending','approved','rejected')) NOT NULL DEFAULT 'pending',
  is_active SMALLINT CHECK (is_active IN (0,1)) NOT NULL DEFAULT 0,
  department VARCHAR(100),
  position VARCHAR(100),
  phone VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMPTZ NULL,
  FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS registration_requests (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36),
  requested_unit_id VARCHAR(36),
  requested_unit_name VARCHAR(255),
  username VARCHAR(100),
  full_name VARCHAR(255) NOT NULL,
  employee_number VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255),
  department VARCHAR(100),
  position VARCHAR(100),
  phone VARCHAR(50),
  status VARCHAR(50) CHECK (status IN ('pending','approved','rejected')) NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(36),
  reviewed_at TIMESTAMPTZ NULL,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_unit_id) REFERENCES units(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ticket_categories (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  legacy_key VARCHAR(100) UNIQUE,
  category_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active SMALLINT CHECK (is_active IN (0,1)) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  ticket_number VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  reporter_id VARCHAR(36),
  reporter_unit_id VARCHAR(36),
  target_unit_id VARCHAR(36),
  category_id VARCHAR(36),
  status VARCHAR(50) NOT NULL DEFAULT 'Baru',
  priority VARCHAR(50) CHECK (priority IN ('Kritis','Tinggi','Sedang','Rendah')) NOT NULL,
  impact VARCHAR(50) CHECK (impact IN ('Individu','Tim','Departemen','Banyak Pengguna')) NOT NULL,
  urgency VARCHAR(50) CHECK (urgency IN ('Rendah','Sedang','Tinggi')) NOT NULL,
  internal_priority INT NOT NULL DEFAULT 0,
  assigned_pic_id VARCHAR(36),
  assigned_team_id VARCHAR(36),
  response_due_at TIMESTAMPTZ NULL,
  resolution_due_at TIMESTAMPTZ NULL,
  first_response_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reporter_unit_id) REFERENCES units(id) ON DELETE SET NULL,
  FOREIGN KEY (target_unit_id) REFERENCES units(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_pic_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  message TEXT NOT NULL,
  visibility VARCHAR(50) CHECK (visibility IN ('public','internal')) NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  uploaded_by VARCHAR(36) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100),
  file_size INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_status_history (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by VARCHAR(36),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pic_assignments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  ticket_id VARCHAR(36) NOT NULL,
  pic_id VARCHAR(36) NOT NULL,
  assigned_by VARCHAR(36),
  assignment_status VARCHAR(50) CHECK (assignment_status IN ('pending','accepted','rejected','completed')) NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (pic_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  ticket_id VARCHAR(36),
  registration_request_id VARCHAR(36),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(50) NOT NULL DEFAULT 'general',
  is_read SMALLINT CHECK (is_read IN (0,1)) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (registration_request_id) REFERENCES registration_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sla_configs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  priority VARCHAR(50) CHECK (priority IN ('Kritis','Tinggi','Sedang','Rendah')) NOT NULL UNIQUE,
  response_minutes INT NOT NULL,
  resolve_hours INT NOT NULL,
  description TEXT,
  is_active SMALLINT CHECK (is_active IN (0,1)) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  actor_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(100),
  target_id VARCHAR(100),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_reporter_id ON tickets(reporter_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_pic_id ON tickets(assigned_pic_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS category_code VARCHAR(50) NULL;
ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS subcategories TEXT NULL;
ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS default_sla_response_minutes INT NULL;
ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS default_sla_resolve_hours INT NULL;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(50) NOT NULL DEFAULT 'Insiden';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS department VARCHAR(100) NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS location VARCHAR(255) NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS asset_reference VARCHAR(255) NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS component_id VARCHAR(100) NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS component_name VARCHAR(255) NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subcategory_name VARCHAR(255) NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags TEXT NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution TEXT NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolution_proof_path VARCHAR(500) NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reopened_count INT NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority_change_reason TEXT NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignment_method VARCHAR(20) NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignment_status VARCHAR(20) NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMPTZ NULL;
ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS entry_type VARCHAR(20) NOT NULL DEFAULT 'comment';

UPDATE tickets
SET due_at = resolution_due_at
WHERE due_at IS NULL AND resolution_due_at IS NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS team VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expertise TEXT NULL;
ALTER TABLE ticket_categories ADD COLUMN IF NOT EXISTS default_team VARCHAR(100) NULL;

CREATE TABLE IF NOT EXISTS assignment_rules (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  category_id VARCHAR(36) NOT NULL,
  target_team VARCHAR(100) NOT NULL,
  default_pic_id VARCHAR(36) NULL,
  load_balancing_strategy VARCHAR(40) NOT NULL DEFAULT 'least_active_workload',
  is_active SMALLINT CHECK (is_active IN (0,1)) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_assignment_rules_category UNIQUE (category_id),
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE,
  FOREIGN KEY (default_pic_id) REFERENCES users(id) ON DELETE SET NULL
);
