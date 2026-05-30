-- backend/src/db/migrations/002_missing_tables.sql
-- Note: pgvector embedding column added only if extension is available

-- ─── Documents ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
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
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, project_id, doc_number)
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_discipline ON documents(discipline);

-- ─── Document Versions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_versions (
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

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_tenant ON document_versions(tenant_id);

-- ─── Transmittal Items ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transmittal_items (
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

CREATE INDEX IF NOT EXISTS idx_transmittal_items_transmittal ON transmittal_items(transmittal_id);
CREATE INDEX IF NOT EXISTS idx_transmittal_items_document ON transmittal_items(document_id);

-- ─── Workflow Steps ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_steps (
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

CREATE INDEX IF NOT EXISTS idx_workflow_steps_document ON workflow_steps(document_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_assignee ON workflow_steps(assignee_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_tenant ON workflow_steps(tenant_id);

-- ─── Comments ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES users(id),
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_document ON comments(document_id);
CREATE INDEX IF NOT EXISTS idx_comments_tenant ON comments(tenant_id);

-- ─── updated_at triggers for new tables ─────────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents','document_versions','transmittal_items','workflow_steps','comments'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
       CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t, t, t
    );
  END LOOP;
END;
$$;
