// backend/src/routes/tasks.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sql } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const CreateTaskBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().optional(),
});

const UpdateTaskBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  // ── List tasks ─────────────────────────────────────────────────────────────
  // Role rules:
  //   admin    → see ALL tasks in the company
  //   manager  → own tasks + direct reports' tasks (manager_id = userId)
  //   engineer → tasks assigned to them OR created by them
  //   user     → tasks assigned to them OR created by them
  app.get('/', async (request, reply) => {
    const { tenantId, id: userId, role } = request.user;
    const query = request.query as { projectId?: string; status?: string; assignedTo?: string };

    const projectCond = query.projectId
      ? sql`AND t.project_id = ${query.projectId}::uuid`
      : sql``;

    const statusCond = query.status
      ? sql`AND t.status = ${query.status}`
      : sql``;

    let visibilityCond = sql``;
    if (role === 'user' || role === 'engineer') {
      // See tasks assigned to them OR created by them
      visibilityCond = sql`AND (t.assigned_to = ${userId}::uuid OR t.created_by = ${userId}::uuid)`;
    } else if (role === 'manager') {
      // Own tasks OR direct reports' tasks
      visibilityCond = sql`
        AND (
          t.assigned_to = ${userId}::uuid
          OR t.created_by = ${userId}::uuid
          OR t.assigned_to IN (
            SELECT id FROM users
            WHERE tenant_id = ${tenantId} AND manager_id = ${userId}::uuid
          )
        )
      `;
    } else if (role === 'admin' && query.assignedTo) {
      visibilityCond = sql`AND t.assigned_to = ${query.assignedTo}::uuid`;
    }
    // admin with no assignedTo filter → all tasks

    const rows = await sql`
      SELECT
        t.id, t.title, t.description, t.status, t.priority,
        t.due_date, t.created_at, t.updated_at,
        t.project_id,
        p.name  AS project_name,
        p.code  AS project_code,
        t.assigned_to,
        u.full_name AS assigned_name,
        t.created_by,
        c.full_name AS created_by_name
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id AND p.tenant_id = ${tenantId}
      LEFT JOIN users u    ON u.id = t.assigned_to AND u.tenant_id = ${tenantId}
      LEFT JOIN users c    ON c.id = t.created_by  AND c.tenant_id = ${tenantId}
      WHERE t.tenant_id = ${tenantId}
      ${projectCond}
      ${statusCond}
      ${visibilityCond}
      ORDER BY
        CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
    `;

    return reply.send(rows);
  });

  // ── Get single task ────────────────────────────────────────────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tenantId, id: userId, role } = request.user;

    const [task] = await sql`
      SELECT t.*,
             u.full_name AS assigned_name,
             c.full_name AS created_by_name,
             p.name AS project_name,
             p.code AS project_code
      FROM tasks t
      LEFT JOIN users u    ON u.id = t.assigned_to AND u.tenant_id = ${tenantId}
      LEFT JOIN users c    ON c.id = t.created_by  AND c.tenant_id = ${tenantId}
      LEFT JOIN projects p ON p.id = t.project_id  AND p.tenant_id = ${tenantId}
      WHERE t.id = ${id} AND t.tenant_id = ${tenantId}
    `;
    if (!task) return reply.code(404).send({ error: 'Task not found' });

    // engineer and user: can see tasks they are assigned to or created
    if ((role === 'engineer' || role === 'user') &&
        task.assignedTo !== userId && task.createdBy !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    if (role === 'manager') {
      // manager can see own tasks or direct reports' tasks
      const isOwn = task.assignedTo === userId || task.createdBy === userId;
      if (!isOwn) {
        const [assignee] = await sql`
          SELECT manager_id FROM users WHERE id = ${task.assignedTo} AND tenant_id = ${tenantId}
        `;
        if (!assignee || assignee.managerId !== userId) {
          return reply.code(403).send({ error: 'Access denied' });
        }
      }
    }

    return reply.send(task);
  });

  // ── Create task ────────────────────────────────────────────────────────────
  // All roles can create tasks; engineer and user always self-assign
  app.post('/', async (request, reply) => {
    const { tenantId, id: userId, role } = request.user;

    const parsed = CreateTaskBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const { title, description, projectId, assignedTo, priority, dueDate } = parsed.data;

    // Only admin and manager can assign tasks to other people
    const canAssignToOthers = role === 'admin' || role === 'manager';
    const finalAssignee = canAssignToOthers ? (assignedTo ?? null) : userId;

    const [task] = await sql`
      INSERT INTO tasks (tenant_id, title, description, project_id, assigned_to, priority, due_date, created_by)
      VALUES (
        ${tenantId}, ${title}, ${description ?? null},
        ${projectId ?? null}, ${finalAssignee},
        ${priority}, ${dueDate ?? null}, ${userId}
      )
      RETURNING *
    `;

    return reply.code(201).send(task);
  });

  // ── Update task ────────────────────────────────────────────────────────────
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tenantId, id: userId, role } = request.user;

    const [existing] = await sql`SELECT * FROM tasks WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!existing) return reply.code(404).send({ error: 'Task not found' });

    // Engineers and users can only update tasks assigned to or created by them
    const isLimitedRole = role === 'engineer' || role === 'user';
    if (isLimitedRole && existing.assignedTo !== userId && existing.createdBy !== userId) {
      return reply.code(403).send({ error: 'You can only update tasks assigned to or created by you' });
    }

    const parsed = UpdateTaskBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }
    const u = parsed.data;

    // Engineers/users cannot reassign tasks to other people
    if (isLimitedRole && u.assignedTo !== undefined && u.assignedTo !== userId) {
      return reply.code(403).send({ error: 'You cannot reassign tasks to other users' });
    }

    const [updated] = await sql`
      UPDATE tasks SET
        title       = COALESCE(${u.title ?? null},       title),
        description = COALESCE(${u.description ?? null}, description),
        status      = COALESCE(${u.status ?? null},      status),
        priority    = COALESCE(${u.priority ?? null},    priority),
        assigned_to = CASE WHEN ${u.assignedTo !== undefined}::boolean
                          THEN ${u.assignedTo ?? null}::uuid
                          ELSE assigned_to END,
        project_id  = CASE WHEN ${u.projectId !== undefined}::boolean
                          THEN ${u.projectId ?? null}::uuid
                          ELSE project_id END,
        due_date    = CASE WHEN ${u.dueDate !== undefined}::boolean
                          THEN ${u.dueDate ?? null}::date
                          ELSE due_date END
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;

    return reply.send(updated);
  });

  // ── Delete task ────────────────────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tenantId, role } = request.user;

    // Only admin and manager can delete tasks
    if (role === 'engineer' || role === 'user') {
      return reply.code(403).send({ error: 'Only managers and admins can delete tasks' });
    }

    const [deleted] = await sql`
      DELETE FROM tasks WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
    `;
    if (!deleted) return reply.code(404).send({ error: 'Task not found' });

    return reply.code(204).send();
  });
}
