-- // backend/src/db/migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- ─── Tenants ────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','manager','engineer','viewer')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ─── Projects ───────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_hold','completed','archived')),
  client_name  TEXT,
  created_by   UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);

-- ─── Documents ──────────────────────────────────────────────────────────────
CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_number       TEXT NOT NULL,
  title            TEXT NOT NULL,
  discipline       TEXT NOT NULL,
  doc_type         TEXT NOT NULL,
  current_version  TEXT NOT NULL DEFAULT 'A',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','rejected','superseded','for_construction','for_information')),
  mdr_status       TEXT CHECK (mdr_status IN ('A','B','C','D')),
  ai_summary       TEXT,
  embedding        vector(1536),
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, project_id, doc_number)
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_discipline ON documents(discipline);
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── Document Versions ──────────────────────────────────────────────────────
CREATE TABLE document_versions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version       TEXT NOT NULL,
  file_key      TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  mime_type     TEXT NOT NULL,
  change_note   TEXT,
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version)
);

CREATE INDEX idx_doc_versions_document ON document_versions(document_id);
CREATE INDEX idx_doc_versions_tenant ON document_versions(tenant_id);

-- ─── Transmittal sequence per project ───────────────────────────────────────
CREATE TABLE transmittal_sequences (
  project_id   UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  next_seq     INTEGER NOT NULL DEFAULT 1
);

-- ─── Transmittals ───────────────────────────────────────────────────────────
CREATE TABLE transmittals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  transmittal_no   TEXT NOT NULL UNIQUE,
  direction        TEXT NOT NULL CHECK (direction IN ('outgoing','incoming')),
  purpose          TEXT NOT NULL CHECK (purpose IN ('for_review','for_construction','for_information','for_approval')),
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','responded','closed')),
  recipient_name   TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  subject          TEXT,
  notes            TEXT,
  sent_at          TIMESTAMPTZ,
  responded_at     TIMESTAMPTZ,
  response_notes   TEXT,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transmittals_tenant ON transmittals(tenant_id);
CREATE INDEX idx_transmittals_project ON transmittals(project_id);
CREATE INDEX idx_transmittals_direction ON transmittals(direction);
CREATE INDEX idx_transmittals_status ON transmittals(status);

-- ─── Transmittal Items ──────────────────────────────────────────────────────
CREATE TABLE transmittal_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transmittal_id      UUID NOT NULL REFERENCES transmittals(id) ON DELETE CASCADE,
  document_id         UUID NOT NULL REFERENCES documents(id),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  response_code       TEXT CHECK (response_code IN ('A','B','C','D')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transmittal_id, document_id)
);

CREATE INDEX idx_transmittal_items_transmittal ON transmittal_items(transmittal_id);
CREATE INDEX idx_transmittal_items_document ON transmittal_items(document_id);

-- ─── Workflow Steps ─────────────────────────────────────────────────────────
CREATE TABLE workflow_steps (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  step_order   INTEGER NOT NULL,
  assignee_id  UUID NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','approved','rejected','skipped')),
  step_name    TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_steps_document ON workflow_steps(document_id);
CREATE INDEX idx_workflow_steps_assignee ON workflow_steps(assignee_id);
CREATE INDEX idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX idx_workflow_steps_tenant ON workflow_steps(tenant_id);

-- ─── Comments ───────────────────────────────────────────────────────────────
CREATE TABLE comments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES users(id),
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_document ON comments(document_id);
CREATE INDEX idx_comments_tenant ON comments(tenant_id);

-- ─── Audit Log ──────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  action       TEXT NOT NULL,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenants','users','projects','documents','document_versions',
    'transmittals','transmittal_items','workflow_steps','comments'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;
