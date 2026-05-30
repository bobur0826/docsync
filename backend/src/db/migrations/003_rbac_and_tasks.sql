-- backend/src/db/migrations/003_rbac_and_tasks.sql
-- RBAC page permissions + Tasks system

-- ─── Page Permissions ────────────────────────────────────────────────────────
-- Defines which pages each ROLE can access per tenant.
-- Admin can also grant/deny specific users (user_id override).
CREATE TABLE IF NOT EXISTS page_permissions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- null = applies to role; set = applies to specific user (overrides role)
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT CHECK (role IN ('admin','manager','engineer','viewer')),
  page_key   TEXT NOT NULL,   -- e.g. 'projects', 'documents', 'transmittals', 'mdr', 'tasks', 'users'
  allowed    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- either role-level OR user-level, not both
  CONSTRAINT chk_role_or_user CHECK (
    (user_id IS NULL AND role IS NOT NULL) OR
    (user_id IS NOT NULL AND role IS NULL)
  ),
  UNIQUE (tenant_id, role, page_key),
  UNIQUE (tenant_id, user_id, page_key)
);

CREATE INDEX IF NOT EXISTS idx_page_perms_tenant ON page_permissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_perms_user   ON page_permissions(user_id);

-- Seed default permissions for all existing tenants
-- Admin sees everything, Manager sees most, Engineer/Viewer see limited
INSERT INTO page_permissions (tenant_id, role, page_key, allowed)
SELECT t.id, r.role, p.page_key, p.allowed
FROM tenants t
CROSS JOIN (VALUES
  ('admin',    'projects',     true),
  ('admin',    'documents',    true),
  ('admin',    'transmittals', true),
  ('admin',    'mdr',          true),
  ('admin',    'tasks',        true),
  ('admin',    'users',        true),
  ('manager',  'projects',     true),
  ('manager',  'documents',    true),
  ('manager',  'transmittals', true),
  ('manager',  'mdr',          true),
  ('manager',  'tasks',        true),
  ('manager',  'users',        false),
  ('engineer', 'projects',     true),
  ('engineer', 'documents',    true),
  ('engineer', 'transmittals', false),
  ('engineer', 'mdr',          false),
  ('engineer', 'tasks',        true),
  ('engineer', 'users',        false),
  ('viewer',   'projects',     true),
  ('viewer',   'documents',    true),
  ('viewer',   'transmittals', false),
  ('viewer',   'mdr',          false),
  ('viewer',   'tasks',        true),
  ('viewer',   'users',        false)
) AS r(role, page_key, allowed) p(page_key, allowed)  -- fix alias
ON CONFLICT DO NOTHING;

-- Simpler seed (works with all PG versions):
DO $$
DECLARE
  t_id UUID;
BEGIN
  FOR t_id IN SELECT id FROM tenants LOOP
    INSERT INTO page_permissions (tenant_id, role, page_key, allowed) VALUES
      (t_id, 'admin',    'projects',     true),
      (t_id, 'admin',    'documents',    true),
      (t_id, 'admin',    'transmittals', true),
      (t_id, 'admin',    'mdr',          true),
      (t_id, 'admin',    'tasks',        true),
      (t_id, 'admin',    'users',        true),
      (t_id, 'manager',  'projects',     true),
      (t_id, 'manager',  'documents',    true),
      (t_id, 'manager',  'transmittals', true),
      (t_id, 'manager',  'mdr',          true),
      (t_id, 'manager',  'tasks',        true),
      (t_id, 'manager',  'users',        false),
      (t_id, 'engineer', 'projects',     true),
      (t_id, 'engineer', 'documents',    true),
      (t_id, 'engineer', 'transmittals', false),
      (t_id, 'engineer', 'mdr',          false),
      (t_id, 'engineer', 'tasks',        true),
      (t_id, 'engineer', 'users',        false),
      (t_id, 'viewer',   'projects',     true),
      (t_id, 'viewer',   'documents',    true),
      (t_id, 'viewer',   'transmittals', false),
      (t_id, 'viewer',   'mdr',          false),
      (t_id, 'viewer',   'tasks',        true),
      (t_id, 'viewer',   'users',        false)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ─── Tasks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by   UUID NOT NULL REFERENCES users(id),
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant     ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned   ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_project    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);

-- updated_at trigger for tasks
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- updated_at trigger for page_permissions
DROP TRIGGER IF EXISTS trg_page_permissions_updated_at ON page_permissions;
-- (no updated_at column on page_permissions, skip)
