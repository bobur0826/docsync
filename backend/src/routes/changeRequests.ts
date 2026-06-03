// backend/src/routes/changeRequests.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { logAudit } from '../middleware/tenant.js';
import { sql } from '../db/client.js';

const CreateBody = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().min(1),
  category:    z.enum(['document', 'transmittal', 'project', 'system', 'other']).default('other'),
  priority:    z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  projectId:   z.string().uuid().optional(),
});

const ReviewBody = z.object({
  status:     z.enum(['in_progress', 'approved', 'rejected']),
  reviewNote: z.string().optional(),
});

const ListQuerySchema = z.object({
  status:   z.string().optional(),
  category: z.string().optional(),
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export async function changeRequestRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  // ── List ─────────────────────────────────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const { tenantId, id: userId, role } = request.user;
    const { status, category, page, pageSize } = parsed.data;
    const offset = (page - 1) * pageSize;

    // Visibility:
    //   admin    → all requests in tenant
    //   manager  → own + direct reports'
    //   engineer/user/viewer → own only
    let rows: Record<string, unknown>[];
    let countRows: { count: string }[];

    if (role === 'admin') {
      rows = await sql`
        SELECT
          cr.*,
          u.full_name  AS requested_by_name,
          u.email      AS requested_by_email,
          rv.full_name AS reviewed_by_name,
          p.name       AS project_name,
          p.code       AS project_code
        FROM change_requests cr
        JOIN users u  ON u.id = cr.requested_by
        LEFT JOIN users rv ON rv.id = cr.reviewed_by
        LEFT JOIN projects p ON p.id = cr.project_id
        WHERE cr.tenant_id = ${tenantId}
          AND (${status ?? null}::text IS NULL OR cr.status = ${status ?? null})
          AND (${category ?? null}::text IS NULL OR cr.category = ${category ?? null})
        ORDER BY
          CASE cr.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
          CASE cr.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          cr.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      countRows = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM change_requests cr
        WHERE cr.tenant_id = ${tenantId}
          AND (${status ?? null}::text IS NULL OR cr.status = ${status ?? null})
          AND (${category ?? null}::text IS NULL OR cr.category = ${category ?? null})
      `;
    } else if (role === 'manager') {
      // own + direct reports
      rows = await sql`
        SELECT
          cr.*,
          u.full_name  AS requested_by_name,
          u.email      AS requested_by_email,
          rv.full_name AS reviewed_by_name,
          p.name       AS project_name,
          p.code       AS project_code
        FROM change_requests cr
        JOIN users u  ON u.id = cr.requested_by
        LEFT JOIN users rv ON rv.id = cr.reviewed_by
        LEFT JOIN projects p ON p.id = cr.project_id
        WHERE cr.tenant_id = ${tenantId}
          AND (cr.requested_by = ${userId} OR u.manager_id = ${userId})
          AND (${status ?? null}::text IS NULL OR cr.status = ${status ?? null})
          AND (${category ?? null}::text IS NULL OR cr.category = ${category ?? null})
        ORDER BY
          CASE cr.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
          CASE cr.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          cr.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      countRows = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count
        FROM change_requests cr
        JOIN users u ON u.id = cr.requested_by
        WHERE cr.tenant_id = ${tenantId}
          AND (cr.requested_by = ${userId} OR u.manager_id = ${userId})
          AND (${status ?? null}::text IS NULL OR cr.status = ${status ?? null})
          AND (${category ?? null}::text IS NULL OR cr.category = ${category ?? null})
      `;
    } else {
      // own only
      rows = await sql`
        SELECT
          cr.*,
          u.full_name  AS requested_by_name,
          u.email      AS requested_by_email,
          rv.full_name AS reviewed_by_name,
          p.name       AS project_name,
          p.code       AS project_code
        FROM change_requests cr
        JOIN users u  ON u.id = cr.requested_by
        LEFT JOIN users rv ON rv.id = cr.reviewed_by
        LEFT JOIN projects p ON p.id = cr.project_id
        WHERE cr.tenant_id = ${tenantId}
          AND cr.requested_by = ${userId}
          AND (${status ?? null}::text IS NULL OR cr.status = ${status ?? null})
          AND (${category ?? null}::text IS NULL OR cr.category = ${category ?? null})
        ORDER BY cr.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      countRows = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM change_requests cr
        WHERE cr.tenant_id = ${tenantId}
          AND cr.requested_by = ${userId}
          AND (${status ?? null}::text IS NULL OR cr.status = ${status ?? null})
          AND (${category ?? null}::text IS NULL OR cr.category = ${category ?? null})
      `;
    }

    return reply.send({ rows, total: parseInt(countRows[0]?.count ?? '0', 10) });
  });

  // ── Create ────────────────────────────────────────────────────────────────────
  app.post('/', async (request, reply) => {
    const parsed = CreateBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const { tenantId, id: userId } = request.user;
    const { title, description, category, priority, projectId } = parsed.data;

    const [cr] = await sql<[Record<string, unknown>]>`
      INSERT INTO change_requests
        (tenant_id, requested_by, title, description, category, priority, project_id)
      VALUES
        (${tenantId}, ${userId}, ${title}, ${description}, ${category}, ${priority}, ${projectId ?? null})
      RETURNING *
    `;

    await logAudit({
      tenantId,
      userId,
      entityType: 'change_request',
      entityId: cr.id as string,
      action: 'create',
      newData: cr,
    });

    return reply.code(201).send(cr);
  });

  // ── Get single ────────────────────────────────────────────────────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tenantId, id: userId, role } = request.user;

    const [cr] = await sql`
      SELECT
        cr.*,
        u.full_name  AS requested_by_name,
        u.email      AS requested_by_email,
        rv.full_name AS reviewed_by_name,
        p.name       AS project_name,
        p.code       AS project_code
      FROM change_requests cr
      JOIN users u  ON u.id = cr.requested_by
      LEFT JOIN users rv ON rv.id = cr.reviewed_by
      LEFT JOIN projects p ON p.id = cr.project_id
      WHERE cr.id = ${id} AND cr.tenant_id = ${tenantId}
    `;

    if (!cr) return reply.code(404).send({ error: 'Not found' });

    // Visibility check
    if (role !== 'admin') {
      const isOwn = cr.requested_by === userId;
      const isDirectReport = role === 'manager'
        ? (await sql`SELECT 1 FROM users WHERE id = ${cr.requested_by as string} AND manager_id = ${userId} AND tenant_id = ${tenantId}`).length > 0
        : false;
      if (!isOwn && !isDirectReport) {
        return reply.code(403).send({ error: 'Access denied' });
      }
    }

    return reply.send(cr);
  });

  // ── Review (admin or manager only) ───────────────────────────────────────────
  app.patch('/:id/review', async (request, reply) => {
    const { role, tenantId, id: userId } = request.user;
    if (role !== 'admin' && role !== 'manager') {
      return reply.code(403).send({ error: 'Only admins and managers can review change requests' });
    }

    const { id } = request.params as { id: string };
    const parsed = ReviewBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const [existing] = await sql`
      SELECT cr.*, u.manager_id
      FROM change_requests cr
      JOIN users u ON u.id = cr.requested_by
      WHERE cr.id = ${id} AND cr.tenant_id = ${tenantId}
    `;
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    // Managers can only review requests from their direct reports (or their own)
    if (role === 'manager') {
      const isOwn = existing.requested_by === userId;
      const isDirectReport = existing.manager_id === userId;
      if (!isOwn && !isDirectReport) {
        return reply.code(403).send({ error: 'You can only review your direct reports\' requests' });
      }
    }

    const { status, reviewNote } = parsed.data;

    const [updated] = await sql<[Record<string, unknown>]>`
      UPDATE change_requests SET
        status      = ${status},
        reviewed_by = ${userId},
        review_note = ${reviewNote ?? null},
        reviewed_at = NOW(),
        updated_at  = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;

    await logAudit({
      tenantId,
      userId,
      entityType: 'change_request',
      entityId: id,
      action: 'review',
      newData: { status, reviewNote },
    });

    return reply.send(updated);
  });

  // ── Delete own pending request ────────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const { tenantId, id: userId, role } = request.user;
    const { id } = request.params as { id: string };

    const [cr] = await sql`
      SELECT * FROM change_requests WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    if (!cr) return reply.code(404).send({ error: 'Not found' });

    // Only the requester (or admin) can delete, and only when pending
    if (role !== 'admin' && cr.requested_by !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    if (cr.status !== 'pending' && role !== 'admin') {
      return reply.code(400).send({ error: 'Only pending requests can be deleted' });
    }

    await sql`DELETE FROM change_requests WHERE id = ${id} AND tenant_id = ${tenantId}`;
    await logAudit({ tenantId, userId, entityType: 'change_request', entityId: id, action: 'delete' });

    return reply.code(204).send();
  });
}
