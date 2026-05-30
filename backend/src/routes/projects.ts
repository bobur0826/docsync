// backend/src/routes/projects.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { logAudit } from '../middleware/tenant.js';

const CreateProjectBody = z.object({
  code: z.string().min(2).max(20).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().optional(),
  clientName: z.string().optional(),
});

const UpdateProjectBody = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  clientName: z.string().optional(),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
});

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  app.get('/', async (request, reply) => {
    const tenantId = request.user.tenantId;
    const rows = await sql`
      SELECT p.*,
             COUNT(DISTINCT d.id) AS document_count,
             COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('draft','sent')) AS open_transmittals,
             MAX(d.updated_at) AS last_activity
      FROM projects p
      LEFT JOIN documents d ON d.project_id = p.id AND d.tenant_id = ${tenantId}
      LEFT JOIN transmittals t ON t.project_id = p.id AND t.tenant_id = ${tenantId}
      WHERE p.tenant_id = ${tenantId}
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `;
    return reply.send(rows);
  });

  app.post('/', async (request, reply) => {
    const parsed = CreateProjectBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }
    const { code, name, description, clientName } = parsed.data;
    const tenantId = request.user.tenantId;

    const existing = await sql`
      SELECT id FROM projects WHERE tenant_id = ${tenantId} AND code = ${code}
    `;
    if (existing.length > 0) {
      return reply.code(409).send({ error: 'Project code already exists in this tenant' });
    }

    const [project] = await sql`
      INSERT INTO projects (tenant_id, code, name, description, client_name, created_by)
      VALUES (${tenantId}, ${code}, ${name}, ${description ?? null}, ${clientName ?? null}, ${request.user.id})
      RETURNING *
    `;

    await logAudit({
      tenantId,
      userId: request.user.id,
      entityType: 'project',
      entityId: project.id as string,
      action: 'create',
      newData: project as Record<string, unknown>,
    });

    return reply.code(201).send(project);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;
    const [project] = await sql`
      SELECT * FROM projects WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    if (!project) return reply.code(404).send({ error: 'Project not found' });
    return reply.send(project);
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;

    const parsed = UpdateProjectBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const [existing] = await sql`SELECT * FROM projects WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!existing) return reply.code(404).send({ error: 'Project not found' });

    const updates = parsed.data;
    const [updated] = await sql`
      UPDATE projects SET
        name = COALESCE(${updates.name ?? null}, name),
        description = COALESCE(${updates.description ?? null}, description),
        client_name = COALESCE(${updates.clientName ?? null}, client_name),
        status = COALESCE(${updates.status ?? null}, status)
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;

    await logAudit({
      tenantId,
      userId: request.user.id,
      entityType: 'project',
      entityId: id,
      action: 'update',
      oldData: existing as Record<string, unknown>,
      newData: updated as Record<string, unknown>,
    });

    return reply.send(updated);
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = request.user.tenantId;

    if (request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin role required to delete projects' });
    }

    const [deleted] = await sql`
      DELETE FROM projects WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
    `;
    if (!deleted) return reply.code(404).send({ error: 'Project not found' });

    await logAudit({
      tenantId,
      userId: request.user.id,
      entityType: 'project',
      entityId: id,
      action: 'delete',
    });

    return reply.code(204).send();
  });
}
