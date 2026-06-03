// backend/src/routes/users.ts
// Admin: manage users + page permissions within the tenant

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sql } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const ALL_PAGES = ['projects', 'documents', 'transmittals', 'mdr', 'tasks', 'users', 'change_requests'] as const;

const InviteBody = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(['admin', 'manager', 'engineer', 'user']),
});

const UpdateUserBody = z.object({
  fullName: z.string().min(2).optional(),
  role: z.enum(['admin', 'manager', 'engineer', 'user']).optional(),
  password: z.string().min(6).optional(),
  // null = remove manager assignment, UUID = assign a manager
  managerId: z.string().uuid().nullable().optional(),
});

const UpdatePermissionsBody = z.object({
  permissions: z.record(z.string(), z.boolean()),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  // ── List all users in this tenant ─────────────────────────────────────────
  app.get('/', async (request, reply) => {
    const { tenantId } = request.user;
    const users = await sql`
      SELECT
        u.id, u.email, u.full_name, u.role, u.created_at,
        u.manager_id,
        m.full_name AS manager_name
      FROM users u
      LEFT JOIN users m ON m.id = u.manager_id AND m.tenant_id = ${tenantId}
      WHERE u.tenant_id = ${tenantId}
      ORDER BY
        CASE u.role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'engineer' THEN 3 ELSE 4 END,
        u.created_at ASC
    `;
    return reply.send(users);
  });

  // ── Invite (create) a new user in this tenant ─────────────────────────────
  // Registered BEFORE /:id routes to avoid routing conflicts
  app.post('/', async (request, reply) => {
    if (request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin only' });
    }
    const parsed = InviteBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const { email, fullName, password, role } = parsed.data;
    const { tenantId } = request.user;

    const existing = await sql`SELECT id FROM users WHERE tenant_id = ${tenantId} AND email = ${email}`;
    if (existing.length > 0) {
      return reply.code(409).send({ error: 'Email already registered in this company' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await sql`
      INSERT INTO users (tenant_id, email, password_hash, full_name, role)
      VALUES (${tenantId}, ${email}, ${passwordHash}, ${fullName}, ${role})
      RETURNING id, email, full_name, role, created_at, manager_id
    `;

    return reply.code(201).send(user);
  });

  // ── Get role-default page permissions ─────────────────────────────────────
  // IMPORTANT: registered before /:id to avoid "permissions" being parsed as an id
  app.get('/permissions/role/:role', async (request, reply) => {
    if (request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin only' });
    }
    const { role } = request.params as { role: string };
    const { tenantId } = request.user;

    const rows = await sql`
      SELECT page_key, allowed FROM page_permissions
      WHERE tenant_id = ${tenantId} AND role = ${role} AND user_id IS NULL
    `;

    const map: Record<string, boolean> = {};
    for (const p of ALL_PAGES) map[p] = false; // default all off
    for (const r of rows) map[r.pageKey as string] = r.allowed as boolean;

    return reply.send(map);
  });

  // ── Update role-default page permissions ───────────────────────────────────
  app.put('/permissions/role/:role', async (request, reply) => {
    if (request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin only' });
    }
    const { role } = request.params as { role: string };
    const { tenantId } = request.user;

    const parsed = UpdatePermissionsBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation error' });

    for (const [page_key, allowed] of Object.entries(parsed.data.permissions)) {
      await sql`
        INSERT INTO page_permissions (tenant_id, role, page_key, allowed)
        VALUES (${tenantId}, ${role}, ${page_key}, ${allowed})
        ON CONFLICT (tenant_id, role, page_key)
          WHERE user_id IS NULL
        DO UPDATE SET allowed = EXCLUDED.allowed
      `;
    }

    return reply.send({ ok: true });
  });

  // ── Get a single user + their effective page permissions ──────────────────
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tenantId } = request.user;

    const [user] = await sql`
      SELECT
        u.id, u.email, u.full_name, u.role, u.created_at,
        u.manager_id,
        m.full_name AS manager_name
      FROM users u
      LEFT JOIN users m ON m.id = u.manager_id AND m.tenant_id = ${tenantId}
      WHERE u.id = ${id} AND u.tenant_id = ${tenantId}
    `;
    if (!user) return reply.code(404).send({ error: 'User not found' });

    // Role defaults first, then user-level overrides on top
    const roleDefaults = await sql`
      SELECT page_key, allowed FROM page_permissions
      WHERE tenant_id = ${tenantId} AND role = ${user.role} AND user_id IS NULL
    `;
    const userOverrides = await sql`
      SELECT page_key, allowed FROM page_permissions
      WHERE tenant_id = ${tenantId} AND user_id = ${id}
    `;

    const permissions: Record<string, boolean> = {};
    for (const p of ALL_PAGES) permissions[p] = false;
    for (const r of roleDefaults) permissions[r.pageKey as string] = r.allowed as boolean;
    for (const r of userOverrides) permissions[r.pageKey as string] = r.allowed as boolean;

    return reply.send({ ...user, permissions });
  });

  // ── Update user ────────────────────────────────────────────────────────────
  // Admin  → can update fullName, role, password, managerId for anyone
  // Manager → can ONLY update managerId (assign/remove their direct reports)
  //           and only set managerId to themselves or null
  // Others → 403
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tenantId, id: requesterId, role: requesterRole } = request.user;

    const isAdmin   = requesterRole === 'admin';
    const isManager = requesterRole === 'manager';

    if (!isAdmin && !isManager) {
      return reply.code(403).send({ error: 'Admin only' });
    }

    const parsed = UpdateUserBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const u = parsed.data;

    // Managers may ONLY touch managerId — not name/role/password of other people
    if (isManager && (u.fullName !== undefined || u.role !== undefined || u.password !== undefined)) {
      return reply.code(403).send({ error: 'Managers can only update employee manager assignments' });
    }

    // Fetch target user first (needed for role check below)
    const [target] = await sql`
      SELECT id, role FROM users WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    if (!target) return reply.code(404).send({ error: 'User not found' });

    // Manager-specific managerId validation
    if (isManager && u.managerId !== undefined) {
      // Manager can only set themselves or clear (null)
      if (u.managerId !== null && u.managerId !== requesterId) {
        return reply.code(403).send({ error: 'Managers can only assign employees to themselves' });
      }
      // Can only manage engineers and users
      if (!['engineer', 'user'].includes(target.role as string)) {
        return reply.code(403).send({ error: 'You can only manage engineers and users' });
      }
    }

    const { fullName, role: newRole, password, managerId } = u;
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;

    const [updated] = await sql`
      UPDATE users SET
        full_name     = COALESCE(${fullName ?? null},  full_name),
        role          = COALESCE(${newRole ?? null},   role),
        password_hash = COALESCE(${passwordHash},      password_hash),
        manager_id    = CASE WHEN ${managerId !== undefined}::boolean
                            THEN ${managerId ?? null}::uuid
                            ELSE manager_id END
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id, email, full_name, role, created_at, manager_id
    `;

    return reply.send(updated);
  });

  // ── Delete a user ──────────────────────────────────────────────────────────
  app.delete('/:id', async (request, reply) => {
    if (request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin only' });
    }
    const { id } = request.params as { id: string };
    const { tenantId, id: selfId } = request.user;

    if (id === selfId) {
      return reply.code(400).send({ error: 'Cannot delete yourself' });
    }

    const [deleted] = await sql`
      DELETE FROM users WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
    `;
    if (!deleted) return reply.code(404).send({ error: 'User not found' });

    return reply.code(204).send();
  });

  // ── Update page permissions for a specific user (overrides role defaults) ──
  app.put('/:id/permissions', async (request, reply) => {
    if (request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin only' });
    }
    const { id } = request.params as { id: string };
    const { tenantId } = request.user;

    const parsed = UpdatePermissionsBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation error' });

    const [user] = await sql`SELECT id FROM users WHERE id = ${id} AND tenant_id = ${tenantId}`;
    if (!user) return reply.code(404).send({ error: 'User not found' });

    // Clear old overrides and write new ones
    await sql`DELETE FROM page_permissions WHERE tenant_id = ${tenantId} AND user_id = ${id}`;

    for (const [page_key, allowed] of Object.entries(parsed.data.permissions)) {
      await sql`
        INSERT INTO page_permissions (tenant_id, user_id, page_key, allowed)
        VALUES (${tenantId}, ${id}, ${page_key}, ${allowed})
      `;
    }

    return reply.send({ ok: true });
  });
}
