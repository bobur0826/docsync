// backend/src/routes/transmittals.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { logAudit } from '../middleware/tenant.js';
import {
  createTransmittal,
  sendTransmittal,
  respondToTransmittal,
  listTransmittals,
  getTransmittalById,
} from '../services/transmittalService.js';

const ListQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  direction: z.enum(['outgoing', 'incoming']).optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const CreateBody = z.object({
  projectId: z.string().uuid(),
  direction: z.enum(['outgoing', 'incoming']),
  purpose: z.enum(['for_review', 'for_construction', 'for_information', 'for_approval']),
  recipientName: z.string().min(1),
  recipientEmail: z.string().email(),
  subject: z.string().optional(),
  notes: z.string().optional(),
  documentIds: z.array(z.string().uuid()).min(1),
});

const RespondBody = z.object({
  responseNotes: z.string().optional(),
  itemResponses: z.array(z.object({
    documentId: z.string().uuid(),
    responseCode: z.enum(['A', 'B', 'C', 'D']),
  })).min(1),
});

export async function transmittalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  app.get('/', async (request, reply) => {
    const parsed = ListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }
    const result = await listTransmittals({ tenantId: request.user.tenantId, ...parsed.data });
    return reply.send(result);
  });

  app.post('/', async (request, reply) => {
    const parsed = CreateBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const result = await createTransmittal({
      tenantId: request.user.tenantId,
      createdBy: request.user.id,
      ...parsed.data,
    });

    await logAudit({
      tenantId: request.user.tenantId,
      userId: request.user.id,
      entityType: 'transmittal',
      entityId: result.transmittal.id,
      action: 'create',
      newData: result.transmittal as unknown as Record<string, unknown>,
    });

    return reply.code(201).send(result);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await getTransmittalById(id, request.user.tenantId);
    if (!result) return reply.code(404).send({ error: 'Transmittal not found' });
    return reply.send(result);
  });

  app.post('/:id/send', async (request, reply) => {
    const { id } = request.params as { id: string };
    const transmittal = await sendTransmittal(id, request.user.tenantId);

    await logAudit({
      tenantId: request.user.tenantId,
      userId: request.user.id,
      entityType: 'transmittal',
      entityId: id,
      action: 'send',
      newData: { status: 'sent', sentAt: transmittal.sentAt },
    });

    return reply.send(transmittal);
  });

  app.post('/:id/respond', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = RespondBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const transmittal = await respondToTransmittal({
      id,
      tenantId: request.user.tenantId,
      ...parsed.data,
    });

    await logAudit({
      tenantId: request.user.tenantId,
      userId: request.user.id,
      entityType: 'transmittal',
      entityId: id,
      action: 'respond',
      newData: { status: 'responded', itemResponses: parsed.data.itemResponses },
    });

    return reply.send(transmittal);
  });
}
