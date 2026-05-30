// backend/src/middleware/tenant.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { sql } from '../db/client.js';

export async function enforceTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user?.tenantId) {
    reply.code(401).send({ error: 'Unauthorized', message: 'Tenant context missing' });
  }
}

export function tenantFilter(tenantId: string) {
  return { tenantId };
}

export async function logAudit(params: {
  tenantId: string;
  userId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string;
}): Promise<void> {
  await sql`
    INSERT INTO audit_log (tenant_id, user_id, entity_type, entity_id, action, old_data, new_data, ip_address)
    VALUES (
      ${params.tenantId},
      ${params.userId},
      ${params.entityType},
      ${params.entityId},
      ${params.action},
      ${params.oldData ? JSON.stringify(params.oldData) : null},
      ${params.newData ? JSON.stringify(params.newData) : null},
      ${params.ipAddress ?? null}
    )
  `;
}
