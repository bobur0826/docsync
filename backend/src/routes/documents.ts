// backend/src/routes/documents.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { logAudit } from '../middleware/tenant.js';
import {
  createDocument,
  uploadNewVersion,
  listDocuments,
  getDocumentById,
  updateDocumentStatus,
  getDocumentVersions,
} from '../services/documentService.js';
import { getPresignedUrl } from '../services/storageService.js';
import { generateDocumentSummary } from '../services/aiService.js';
import { sql } from '../db/client.js';

const ListQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.string().optional(),
  discipline: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const StatusBody = z.object({
  status: z.enum(['draft', 'in_review', 'approved', 'rejected', 'superseded', 'for_construction', 'for_information']),
});

const WorkflowBody = z.object({
  steps: z.array(z.object({
    assigneeId: z.string().uuid(),
    stepName: z.string().min(1),
  })).min(1),
});

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  app.get('/', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }
    const result = await listDocuments({ tenantId: request.user.tenantId, ...parsed.data });
    return reply.send(result);
  });

  app.post('/', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'File is required' });

    const fields = data.fields as Record<string, { value: string }>;
    const required = ['projectId', 'docNumber', 'title', 'discipline', 'docType'];
    for (const f of required) {
      if (!fields[f]?.value) {
        return reply.code(400).send({ error: `Field '${f}' is required` });
      }
    }

    const BodySchema = z.object({
      projectId: z.string().uuid(),
      docNumber: z.string().min(1),
      title: z.string().min(1),
      discipline: z.string().min(1),
      docType: z.string().min(1),
      changeNote: z.string().optional(),
    });

    const parsed = BodySchema.safeParse({
      projectId: fields.projectId.value,
      docNumber: fields.docNumber.value,
      title: fields.title.value,
      discipline: fields.discipline.value,
      docType: fields.docType.value,
      changeNote: fields.changeNote?.value,
    });
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    const result = await createDocument({
      tenantId: request.user.tenantId,
      createdBy: request.user.id,
      file: buffer,
      fileName: data.filename,
      mimeType: data.mimetype,
      ...parsed.data,
    });

    await logAudit({
      tenantId: request.user.tenantId,
      userId: request.user.id,
      entityType: 'document',
      entityId: result.document.id,
      action: 'create',
      newData: result.document as unknown as Record<string, unknown>,
    });

    return reply.code(201).send(result);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = await getDocumentById(id, request.user.tenantId);
    if (!doc) return reply.code(404).send({ error: 'Document not found' });

    const versions = await getDocumentVersions(id, request.user.tenantId);
    const versionsWithUrls = await Promise.all(
      versions.map(async (v) => ({
        ...v,
        downloadUrl: await getPresignedUrl(v.fileKey),
      }))
    );

    return reply.send({ ...doc, versions: versionsWithUrls });
  });

  // ── Edit document metadata ────────────────────────────────────────────────
  app.patch('/:id', async (request, reply) => {
    const { role, tenantId, id: userId } = request.user;
    if (role === 'user') {
      return reply.code(403).send({ error: 'You do not have permission to edit documents' });
    }
    const { id } = request.params as { id: string };

    const EditBody = z.object({
      title: z.string().min(1).optional(),
      discipline: z.string().min(1).optional(),
      docType: z.string().min(1).optional(),
      currentVersion: z.string().min(1).optional(),
    });
    const parsed = EditBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }
    const u = parsed.data;
    if (Object.keys(u).length === 0) {
      return reply.code(400).send({ error: 'No fields to update' });
    }

    const [doc] = await sql<[{ id: string }?]>`
      UPDATE documents SET
        title          = CASE WHEN ${u.title !== undefined}::boolean         THEN ${u.title ?? null}         ELSE title          END,
        discipline     = CASE WHEN ${u.discipline !== undefined}::boolean    THEN ${u.discipline ?? null}    ELSE discipline     END,
        doc_type       = CASE WHEN ${u.docType !== undefined}::boolean       THEN ${u.docType ?? null}       ELSE doc_type       END,
        current_version= CASE WHEN ${u.currentVersion !== undefined}::boolean THEN ${u.currentVersion ?? null} ELSE current_version END,
        updated_at     = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id
    `;
    if (!doc) return reply.code(404).send({ error: 'Document not found' });

    await logAudit({ tenantId, userId, entityType: 'document', entityId: id, action: 'update', newData: u });
    const updated = await getDocumentById(id, tenantId);
    return reply.send(updated);
  });

  // ── Delete document ───────────────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const { role, tenantId, id: userId } = request.user;
    if (role !== 'admin' && role !== 'manager') {
      return reply.code(403).send({ error: 'Only admins and managers can delete documents' });
    }
    const { id } = request.params as { id: string };

    const [doc] = await sql<[{ id: string }?]>`
      DELETE FROM documents WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
    `;
    if (!doc) return reply.code(404).send({ error: 'Document not found' });

    await logAudit({ tenantId, userId, entityType: 'document', entityId: id, action: 'delete' });
    return reply.code(204).send();
  });

  app.patch('/:id/status', async (request, reply) => {
    // Users (basic role) cannot change document status
    if (request.user.role === 'user') {
      return reply.code(403).send({ error: 'Users cannot change document status' });
    }
    const { id } = request.params as { id: string };
    const parsed = StatusBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const doc = await updateDocumentStatus(id, request.user.tenantId, parsed.data.status);

    await logAudit({
      tenantId: request.user.tenantId,
      userId: request.user.id,
      entityType: 'document',
      entityId: id,
      action: 'status_change',
      newData: { status: parsed.data.status },
    });

    return reply.send(doc);
  });

  app.get('/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const versions = await getDocumentVersions(id, request.user.tenantId);
    const withUrls = await Promise.all(
      versions.map(async (v) => ({ ...v, downloadUrl: await getPresignedUrl(v.fileKey) }))
    );
    return reply.send(withUrls);
  });

  app.post('/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'File is required' });

    const fields = data.fields as Record<string, { value: string }>;
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    const result = await uploadNewVersion({
      tenantId: request.user.tenantId,
      documentId: id,
      uploadedBy: request.user.id,
      file: buffer,
      fileName: data.filename,
      mimeType: data.mimetype,
      changeNote: fields.changeNote?.value,
    });

    return reply.code(201).send(result);
  });

  app.post('/:id/workflow', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = WorkflowBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const { createWorkflow } = await import('../services/workflowService.js');
    const steps = await createWorkflow({
      tenantId: request.user.tenantId,
      documentId: id,
      steps: parsed.data.steps,
    });

    return reply.code(201).send(steps);
  });

  app.post('/:id/ai-summary', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;

    const doc = await getDocumentById(id, tenantId);
    if (!doc) return reply.code(404).send({ error: 'Document not found' });

    const [project] = await sql<[{ name: string }]>`
      SELECT name FROM projects WHERE id = ${doc.projectId} AND tenant_id = ${tenantId}
    `;

    const summary = await generateDocumentSummary({
      docNumber: doc.docNumber,
      title: doc.title,
      discipline: doc.discipline,
      docType: doc.docType,
      project: project?.name ?? 'Unknown',
      version: doc.currentVersion,
      status: doc.status,
    });

    await sql`
      UPDATE documents SET ai_summary = ${summary} WHERE id = ${id} AND tenant_id = ${tenantId}
    `;

    return reply.send({ summary });
  });
}
