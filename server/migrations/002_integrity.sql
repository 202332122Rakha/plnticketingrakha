-- Retain security state in PostgreSQL. Existing legacy passwords are never reset by migrations.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ticket_attachments ADD COLUMN IF NOT EXISTS file_content BYTEA;
ALTER TABLE assignment_rules ADD COLUMN IF NOT EXISTS last_pic_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_lower ON users (lower(employee_number));
CREATE UNIQUE INDEX IF NOT EXISTS uq_units_code_lower ON units (lower(unit_code));
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_code_lower ON ticket_categories (lower(category_code)) WHERE category_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_registration_pending_email ON registration_requests (lower(email)) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_registration_pending_username ON registration_requests (lower(username)) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_registration_pending_nip ON registration_requests (lower(employee_number)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tickets_reporter_unit ON tickets (reporter_unit_id);
CREATE INDEX IF NOT EXISTS idx_tickets_target_unit ON tickets (target_unit_id);
CREATE INDEX IF NOT EXISTS idx_comments_ticket_time ON ticket_comments (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_history_ticket_time ON ticket_status_history (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['units','users','registration_requests','ticket_categories','tickets','ticket_comments','pic_assignments','sla_configs','assignment_rules']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END;
$$;
