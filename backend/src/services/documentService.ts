// backend/src/services/documentService.ts

import { sql } from '../db/client.js';
import { uploadFile, UploadResult } from './storageService.js';
import { generateAndStoreEmbedding } from './aiService.js';

export interface DocumentRow {
  id: string;
  tenantId: string;
  projectId: string;
  docNumber: string;
  title: string;
  discipline: string;
  docType: string;
  currentVersion: string;
  status: string;
  mdrStatus: string | null;
  aiSummary: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersionRow {
  id: string;
  tenantId: string;
  documentId: string;
  version: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  changeNote: string | null;
  uploadedBy: string;
  createdAt: Date;
}

function nextVersion(current: string): string {
  if (/^\d+$/.test(current)) {
    return String(Number(current) + 1);
  }
  const code = current.toUpperCase().charCodeAt(0);
  if (code >= 65 && code < 90) {
    return String.fromCharCode(code + 1);
  }
  return `${current}_1`;
}

export async function createDocument(params: {
  tenantId: string;
  projectId: string;
  docNumber: string;
  title: string;
  discipline: string;
  docType: string;
  createdBy: string;
  file: Buffer;
  fileName: string;
  mimeType: string;
  changeNote?: string;
}): Promise<{ document: DocumentRow; version: DocumentVersionRow }> {
  return await sql.begin(async (tx) => {
    const [doc] = await tx<DocumentRow[]>`
      INSERT INTO documents (tenant_id, project_id, doc_number, title, discipline, doc_type, current_version, created_by)
      VALUES (${params.tenantId}, ${params.projectId}, ${params.docNumber}, ${params.title},
              ${params.discipline}, ${params.docType}, 'A', ${params.createdBy})
      RETURNING *
    `;

    const upload: UploadResult = await uploadFile(
      params.file,
      params.fileName,
      params.mimeType,
      `${params.tenantId}/${params.projectId}`
    );

    const [version] = await tx<DocumentVersionRow[]>`
      INSERT INTO document_versions (tenant_id, document_id, version, file_key, file_name, file_size, mime_type, change_note, uploaded_by)
      VALUES (${params.tenantId}, ${doc.id}, 'A', ${upload.key}, ${upload.fileName},
              ${upload.fileSize}, ${upload.mimeType}, ${params.changeNote ?? null}, ${params.createdBy})
      RETURNING *
    `;

    const embedText = `${doc.docNumber} ${doc.title} ${doc.discipline} ${doc.docType}`;
    generateAndStoreEmbedding(doc.id, params.tenantId, embedText).catch(() => {});

    return { document: doc, version };
  });
}

export async function uploadNewVersion(params: {
  tenantId: string;
  documentId: string;
  uploadedBy: string;
  file: Buffer;
  fileName: string;
  mimeType: string;
  changeNote?: string;
}): Promise<{ document: DocumentRow; version: DocumentVersionRow }> {
  return await sql.begin(async (tx) => {
    const [current] = await tx<DocumentRow[]>`
      SELECT * FROM documents WHERE id = ${params.documentId} AND tenant_id = ${params.tenantId}
      FOR UPDATE
    `;
    if (!current) throw new Error('Document not found');

    const newVersion = nextVersion(current.currentVersion);

    const upload: UploadResult = await uploadFile(
      params.file,
      params.fileName,
      params.mimeType,
      `${params.tenantId}/${current.projectId}`
    );

    const [version] = await tx<DocumentVersionRow[]>`
      INSERT INTO document_versions (tenant_id, document_id, version, file_key, file_name, file_size, mime_type, change_note, uploaded_by)
      VALUES (${params.tenantId}, ${params.documentId}, ${newVersion}, ${upload.key},
              ${upload.fileName}, ${upload.fileSize}, ${upload.mimeType},
              ${params.changeNote ?? null}, ${params.uploadedBy})
      RETURNING *
    `;

    const [doc] = await tx<DocumentRow[]>`
      UPDATE documents SET current_version = ${newVersion} WHERE id = ${params.documentId}
      RETURNING *
    `;

    const embedText = `${doc.docNumber} ${doc.title} ${doc.discipline} ${doc.docType}`;
    generateAndStoreEmbedding(doc.id, params.tenantId, embedText).catch(() => {});

    return { document: doc, version };
  });
}

export async function listDocuments(params: {
  tenantId: string;
  projectId?: string;
  status?: string;
  discipline?: string;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ rows: DocumentRow[]; total: number }> {
  const offset = (params.page - 1) * params.pageSize;

  const conditions: string[] = [`d.tenant_id = '${params.tenantId}'`];
  if (params.projectId) conditions.push(`d.project_id = '${params.projectId}'`);
  if (params.status) conditions.push(`d.status = '${params.status}'`);
  if (params.discipline) conditions.push(`d.discipline = '${params.discipline}'`);
  if (params.search) conditions.push(`(d.title ILIKE '%${params.search}%' OR d.doc_number ILIKE '%${params.search}%')`);

  const where = conditions.join(' AND ');

  const rows = await sql<DocumentRow[]>`
    SELECT d.* FROM documents d
    WHERE ${sql.unsafe(where)}
    ORDER BY d.updated_at DESC
    LIMIT ${params.pageSize} OFFSET ${offset}
  `;

  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*) FROM documents d WHERE ${sql.unsafe(where)}
  `;

  return { rows, total: Number(count) };
}

export async function getDocumentById(
  id: string,
  tenantId: string
): Promise<DocumentRow | null> {
  const [row] = await sql<DocumentRow[]>`
    SELECT * FROM documents WHERE id = ${id} AND tenant_id = ${tenantId}
  `;
  return row ?? null;
}

export async function updateDocumentStatus(
  id: string,
  tenantId: string,
  status: string
): Promise<DocumentRow> {
  const [row] = await sql<DocumentRow[]>`
    UPDATE documents SET status = ${status} WHERE id = ${id} AND tenant_id = ${tenantId}
    RETURNING *
  `;
  if (!row) throw new Error('Document not found');
  return row;
}

export async function getDocumentVersions(
  documentId: string,
  tenantId: string
): Promise<DocumentVersionRow[]> {
  return sql<DocumentVersionRow[]>`
    SELECT * FROM document_versions
    WHERE document_id = ${documentId} AND tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `;
}
