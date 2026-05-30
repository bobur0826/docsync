// backend/src/routes/workflows.ts

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { logAudit } from '../middleware/tenant.js';
import {
  getPendingSteps,
  completeWorkflowStep,
  getDocumentWorkflow,
} from '../services/workflowService.js';

const CompleteBody = z.object({
  decision: z.enum(['approved', 'rejected']),
  comment: z.string().optional(),
});

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authenticate);

  app.get('/pending', async (request, reply) => {
    const steps = await getPendingSteps(request.user.id, request.user.tenantId);
    return reply.send(steps);
  });

  app.get('/document/:documentId', async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const steps = await getDocumentWorkflow(documentId, request.user.tenantId);
    return reply.send(steps);
  });

  app.post('/:stepId/complete', async (request, reply) => {
    const { stepId } = request.params as { stepId: string };
    const parsed = CompleteBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', issues: parsed.error.issues });
    }

    const step = await completeWorkflowStep({
      stepId,
      tenantId: request.user.tenantId,
      userId: request.user.id,
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });

    await logAudit({
      tenantId: request.user.tenantId,
      userId: request.user.id,
      entityType: 'workflow_step',
      entityId: stepId,
      action: parsed.data.decision,
      newData: { decision: parsed.data.decision, comment: parsed.data.comment },
    });

    return reply.send(step);
  });
}
