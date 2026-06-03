-- backend/src/db/migrations/004_change_requests.sql
-- Change Requests: any user submits → manager + admin review

CREATE TABLE IF NOT EXISTS change_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'other'
                 CHECK (category IN ('document','transmittal','project','system','other')),
  priority     TEXT NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low','medium','high','urgent')),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','in_progress','approved','rejected')),
  requested_by UUID NOT NULL REFERENCES users(id),
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  review_note  TEXT,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_requests_tenant      ON change_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_requested   ON change_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_change_requests_status      ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_project     ON change_requests(project_id);

DROP TRIGGER IF EXISTS trg_change_requests_updated_at ON change_requests;
CREATE TRIGGER trg_change_requests_updated_at
  BEFORE UPDATE ON change_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Default page permissions for change_requests ─────────────────────────────
-- All roles can access the page; visibility is controlled by the backend logic
DO $$
DECLARE
  t_id UUID;
BEGIN
  FOR t_id IN SELECT id FROM tenants LOOP
    INSERT INTO page_permissions (tenant_id, role, page_key, allowed) VALUES
      (t_id, 'admin',    'change_requests', true),
      (t_id, 'manager',  'change_requests', true),
      (t_id, 'engineer', 'change_requests', true),
      (t_id, 'user',     'change_requests', true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
