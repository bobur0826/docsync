// backend/src/services/transmittalService.ts

import { sql } from '../db/client.js';

export interface TransmittalRow {
  id: string;
  tenantId: string;
  projectId: string;
  transmittalNo: string;
  direction: string;
  purpose: string;
  status: string;
  recipientName: string;
  recipientEmail: string;
  subject: string | null;
  notes: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  responseNotes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransmittalItemRow {
  id: string;
  tenantId: string;
  transmittalId: string;
  documentId: string;
  documentVersionId: string;
  responseCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function generateTransmittalNumber(
  tx: Parameters<Parameters<typeof sql.begin>[0]>[0],
  projectId: string,
  projectCode: string
): Promise<string> {
  await tx`
    INSERT INTO transmittal_sequences (project_id, next_seq)
    VALUES (${projectId}, 1)
    ON CONFLICT (project_id) DO NOTHING
  `;

  const [{ nextSeq }] = await tx<[{ nextSeq: number }]>`
    UPDATE transmittal_sequences
    SET next_seq = next_seq + 1
    WHERE project_id = ${projectId}
    RETURNING next_seq - 1 AS next_seq
  `;

  return `TRS-${projectCode.toUpperCase()}-${String(nextSeq).padStart(4, '0')}`;
}

export async function createTransmittal(params: {
  tenantId: string;
  projectId: string;
  direction: string;
  purpose: string;
  recipientName: string;
  recipientEmail: string;
  subject?: string;
  notes?: string;
  createdBy: string;
  documentIds: string[];
}): Promise<{ transmittal: TransmittalRow; items: TransmittalItemRow[] }> {
  return await sql.begin(async (tx) => {
    const [project] = await tx<[{ code: string }]>`
      SELECT code FROM projects WHERE id = ${params.projectId} AND tenant_id = ${params.tenantId}
    `;
    if (!project) throw new Error('Project not found');

    const transmittalNo = await generateTransmittalNumber(tx, params.projectId, project.code);

    const [transmittal] = await tx<TransmittalRow[]>`
      INSERT INTO transmittals (
        tenant_id, project_id, transmittal_no, direction, purpose,
        recipient_name, recipient_email, subject, notes, created_by
      )
      VALUES (
        ${params.tenantId}, ${params.projectId}, ${transmittalNo}, ${params.direction},
        ${params.purpose}, ${params.recipientName}, ${params.recipientEmail},
        ${params.subject ?? null}, ${params.notes ?? null}, ${params.createdBy}
      )
      RETURNING *
    `;

    const items: TransmittalItemRow[] = [];
    for (const docId of params.documentIds) {
      const [latestVersion] = await tx<[{ id: string }]>`
        SELECT id FROM document_versions
        WHERE document_id = ${docId} AND tenant_id = ${params.tenantId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!latestVersion) throw new Error(`No version found for document ${docId}`);

      const [item] = await tx<TransmittalItemRow[]>`
        INSERT INTO transmittal_items (tenant_id, transmittal_id, document_id, document_version_id)
        VALUES (${params.tenantId}, ${transmittal.id}, ${docId}, ${latestVersion.id})
        RETURNING *
      `;
      items.push(item);
    }

    return { transmittal, items };
  });
}

export async function sendTransmittal(
  id: string,
  tenantId: string
): Promise<TransmittalRow> {
  const [row] = await sql<TransmittalRow[]>`
    UPDATE transmittals
    SET status = 'sent', sent_at = NOW()
    WHERE id = ${id} AND tenant_id = ${tenantId} AND status = 'draft'
    RETURNING *
  `;
  if (!row) throw new Error('Transmittal not found or already sent');
  return row;
}

export async function respondToTransmittal(params: {
  id: string;
  tenantId: string;
  responseNotes?: string;
  itemResponses: { documentId: string; responseCode: 'A' | 'B' | 'C' | 'D' }[];
}): Promise<TransmittalRow> {
  return await sql.begin(async (tx) => {
    const [transmittal] = await tx<TransmittalRow[]>`
      UPDATE transmittals
      SET status = 'responded', responded_at = NOW(), response_notes = ${params.responseNotes ?? null}
      WHERE id = ${params.id} AND tenant_id = ${params.tenantId} AND status = 'sent'
      RETURNING *
    `;
    if (!transmittal) throw new Error('Transmittal not found or not in sent state');

    for (const ir of params.itemResponses) {
      await tx`
        UPDATE transmittal_items
        SET response_code = ${ir.responseCode}
        WHERE transmittal_id = ${params.id}
          AND document_id = ${ir.documentId}
          AND tenant_id = ${params.tenantId}
      `;

      await tx`
        UPDATE documents
        SET mdr_status = ${ir.responseCode}
        WHERE id = ${ir.documentId} AND tenant_id = ${params.tenantId}
      `;
    }

    return transmittal;
  });
}

export async function listTransmittals(params: {
  tenantId: string;
  projectId?: string;
  direction?: string;
  status?: string;
  page: number;
  pageSize: number;
}): Promise<{ rows: TransmittalRow[]; total: number }> {
  const offset = (params.page - 1) * params.pageSize;

  const conditions = [`tenant_id = '${params.tenantId}'`];
  if (params.projectId) conditions.push(`project_id = '${params.projectId}'`);
  if (params.direction) conditions.push(`direction = '${params.direction}'`);
  if (params.status) conditions.push(`status = '${params.status}'`);

  const where = conditions.join(' AND ');

  const rows = await sql<TransmittalRow[]>`
    SELECT * FROM transmittals
    WHERE ${sql.unsafe(where)}
    ORDER BY created_at DESC
    LIMIT ${params.pageSize} OFFSET ${offset}
  `;

  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*) FROM transmittals WHERE ${sql.unsafe(where)}
  `;

  return { rows, total: Number(count) };
}

export async function getTransmittalById(
  id: string,
  tenantId: string
): Promise<{ transmittal: TransmittalRow; items: TransmittalItemRow[] } | null> {
  const [transmittal] = await sql<TransmittalRow[]>`
    SELECT * FROM transmittals WHERE id = ${id} AND tenant_id = ${tenantId}
  `;
  if (!transmittal) return null;

  const items = await sql<TransmittalItemRow[]>`
    SELECT * FROM transmittal_items WHERE transmittal_id = ${id} AND tenant_id = ${tenantId}
  `;

  return { transmittal, items };
}
