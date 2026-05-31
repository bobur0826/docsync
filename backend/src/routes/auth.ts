// backend/src/routes/auth.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sql } from '../db/client.js';
import type { JwtPayload } from '../middleware/auth.js';

const RegisterBody = z.object({
  tenantName: z.string().min(2),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
});

// Login now accepts optional tenantId for multi-company users
const LoginBody = z.object({
  email: z.string().email(),
  password: z.string(),
  tenantId: z.string().uuid().optional(),
});

const SwitchBody = z.object({
  tenantId: z.string().uuid(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ── Register (creates new company + admin user) ───────────────────────────
  app.post('/register', async (request, reply) => {
    const parsed = RegisterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }
    const { tenantName, tenantSlug, email, password, fullName } = parsed.data;

    const existing = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug}`;
    if (existing.length > 0) {
      return reply.code(409).send({ error: 'Company slug already taken' });
    }

    const [tenant] = await sql<[{ id: string }]>`
      INSERT INTO tenants (name, slug) VALUES (${tenantName}, ${tenantSlug}) RETURNING id
    `;

    // Check if this email already exists in another tenant — reuse same password hash
    const [existingUser] = await sql<[{ passwordHash: string }]>`
      SELECT password_hash FROM users WHERE email = ${email} LIMIT 1
    `;

    // If user already exists elsewhere, verify password matches before linking
    let passwordHash: string;
    if (existingUser) {
      const valid = await bcrypt.compare(password, existingUser.passwordHash);
      if (!valid) {
        // Roll back tenant creation
        await sql`DELETE FROM tenants WHERE id = ${tenant.id}`;
        return reply.code(400).send({
          error: 'Password mismatch',
          message: 'You already have an account with a different password. Use your existing password to add a new company.',
        });
      }
      passwordHash = existingUser.passwordHash;
    } else {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const [user] = await sql<[{ id: string; role: string }]>`
      INSERT INTO users (tenant_id, email, password_hash, full_name, role)
      VALUES (${tenant.id}, ${email}, ${passwordHash}, ${fullName}, 'admin')
      RETURNING id, role
    `;

    // Seed default page permissions for this new tenant's admin
    await sql`
      INSERT INTO page_permissions (tenant_id, role, page_key, allowed)
      VALUES
        (${tenant.id}, 'admin',    'projects',     true),
        (${tenant.id}, 'admin',    'documents',    true),
        (${tenant.id}, 'admin',    'transmittals', true),
        (${tenant.id}, 'admin',    'mdr',          true),
        (${tenant.id}, 'admin',    'tasks',        true),
        (${tenant.id}, 'admin',    'users',        true),
        (${tenant.id}, 'manager',  'projects',     true),
        (${tenant.id}, 'manager',  'documents',    true),
        (${tenant.id}, 'manager',  'transmittals', true),
        (${tenant.id}, 'manager',  'mdr',          true),
        (${tenant.id}, 'manager',  'tasks',        true),
        (${tenant.id}, 'manager',  'users',        false),
        (${tenant.id}, 'engineer', 'projects',     true),
        (${tenant.id}, 'engineer', 'documents',    true),
        (${tenant.id}, 'engineer', 'transmittals', false),
        (${tenant.id}, 'engineer', 'mdr',          false),
        (${tenant.id}, 'engineer', 'tasks',        true),
        (${tenant.id}, 'engineer', 'users',        false),
        (${tenant.id}, 'user',     'projects',     true),
        (${tenant.id}, 'user',     'documents',    true),
        (${tenant.id}, 'user',     'transmittals', false),
        (${tenant.id}, 'user',     'mdr',          false),
        (${tenant.id}, 'user',     'tasks',        true),
        (${tenant.id}, 'user',     'users',        false)
      ON CONFLICT DO NOTHING
    `;

    const token = app.jwt.sign({
      id: user.id,
      tenantId: tenant.id,
      role: user.role as JwtPayload['role'],
      email,
    });

    return reply.code(201).send({ token, userId: user.id, tenantId: tenant.id });
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  // If user belongs to multiple companies and no tenantId given → return company list
  app.post('/login', async (request, reply) => {
    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }
    const { email, password, tenantId } = parsed.data;

    // Find all accounts with this email
    const users = await sql<{ id: string; tenantId: string; role: string; passwordHash: string; tenantName: string; tenantSlug: string }[]>`
      SELECT u.id, u.tenant_id, u.role, u.password_hash, t.name AS tenant_name, t.slug AS tenant_slug
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = ${email}
      ORDER BY t.name
    `;

    if (users.length === 0) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, users[0].passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Multiple companies and no tenantId selected → ask user to pick
    if (users.length > 1 && !tenantId) {
      return reply.send({
        requiresCompanySelection: true,
        companies: users.map((u) => ({
          tenantId: u.tenantId,
          tenantName: u.tenantName,
          tenantSlug: u.tenantSlug,
          role: u.role,
        })),
      });
    }

    // Find the right user record
    const user = tenantId
      ? users.find((u) => u.tenantId === tenantId)
      : users[0];

    if (!user) {
      return reply.code(401).send({ error: 'No access to this company' });
    }

    const token = app.jwt.sign({
      id: user.id,
      tenantId: user.tenantId,
      role: user.role as JwtPayload['role'],
      email,
    });

    return reply.send({ token, userId: user.id, tenantId: user.tenantId });
  });

  // ── Switch company (no password re-entry needed) ──────────────────────────
  app.post('/switch', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    const parsed = SwitchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error' });
    }
    const { tenantId } = parsed.data;
    const { email } = request.user as { email: string };

    // Find the user record for this email in the target company
    const [user] = await sql<[{ id: string; tenantId: string; role: string }]>`
      SELECT u.id, u.tenant_id, u.role
      FROM users u
      WHERE u.email = ${email} AND u.tenant_id = ${tenantId}
    `;

    if (!user) {
      return reply.code(403).send({ error: 'You do not have access to this company' });
    }

    const token = app.jwt.sign({
      id: user.id,
      tenantId: user.tenantId,
      role: user.role as JwtPayload['role'],
      email,
    });

    return reply.send({ token, userId: user.id, tenantId: user.tenantId });
  });

  // ── List all companies this user belongs to ───────────────────────────────
  app.get('/my-companies', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    const { email } = request.user as { email: string };

    const companies = await sql`
      SELECT t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug, u.role
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = ${email}
      ORDER BY t.name
    `;

    return reply.send(companies);
  });

  // ── Me (current user + page permissions) ─────────────────────────────────
  app.get('/me', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    const { id: userId, tenantId } = request.user as { id: string; tenantId: string };

    const [user] = await sql<[{ id: string; email: string; fullName: string; role: string; tenantId: string; tenantName: string }]>`
      SELECT u.id, u.email, u.full_name, u.role, u.tenant_id, t.name AS tenant_name
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = ${userId} AND u.tenant_id = ${tenantId}
    `;
    if (!user) return reply.code(404).send({ error: 'User not found' });

    // Compute effective page permissions
    const rolePerms = await sql`
      SELECT page_key, allowed FROM page_permissions
      WHERE tenant_id = ${tenantId} AND role = ${user.role} AND user_id IS NULL
    `;
    const userPerms = await sql`
      SELECT page_key, allowed FROM page_permissions
      WHERE tenant_id = ${tenantId} AND user_id = ${userId}
    `;

    const pages: Record<string, boolean> = {};
    for (const r of rolePerms) pages[r.pageKey as string] = r.allowed as boolean;
    for (const r of userPerms) pages[r.pageKey as string] = r.allowed as boolean;

    return reply.send({ ...user, pages });
  });
}
