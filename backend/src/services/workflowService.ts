// backend/src/services/workflowService.ts

import { sql } from '../db/client.js';

export interface WorkflowStepRow {
  id: string;
  tenantId: string;
  documentId: string;
  stepOrder: number;
  assigneeId: string;
  status: string;
  stepName: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStepWithUser extends WorkflowStepRow {
  assigneeName: string;
  assigneeEmail: string;
  docNumber: string;
  docTitle: string;
  projectName: string;
}

export async function createWorkflow(params: {
  tenantId: string;
  documentId: string;
  steps: { assigneeId: string; stepName: string }[];
}): Promise<WorkflowStepRow[]> {
  return await sql.begin(async (tx) => {
    await tx`
      DELETE FROM workflow_steps
      WHERE document_id = ${params.documentId} AND tenant_id = ${params.tenantId}
        AND status = 'pending'
    `;

    await tx`
      UPDATE documents SET status = 'in_review'
      WHERE id = ${params.documentId} AND tenant_id = ${params.tenantId}
    `;

    const insertedSteps: WorkflowStepRow[] = [];
    for (let i = 0; i < params.steps.length; i++) {
      const step = params.steps[i];
      const status = i === 0 ? 'active' : 'pending';
      const [row] = await tx<WorkflowStepRow[]>`
        INSERT INTO workflow_steps (tenant_id, document_id, step_order, assignee_id, status, step_name)
        VALUES (${params.tenantId}, ${params.documentId}, ${i + 1}, ${step.assigneeId}, ${status}, ${step.stepName})
        RETURNING *
      `;
      insertedSteps.push(row);
    }

    return insertedSteps;
  });
}

export async function completeWorkflowStep(params: {
  stepId: string;
  tenantId: string;
  userId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
}): Promise<WorkflowStepRow> {
  return await sql.begin(async (tx) => {
    const [step] = await tx<WorkflowStepRow[]>`
      SELECT * FROM workflow_steps
      WHERE id = ${params.stepId} AND tenant_id = ${params.tenantId}
        AND assignee_id = ${params.userId} AND status = 'active'
      FOR UPDATE
    `;
    if (!step) throw new Error('Step not found or not active for this user');

    const [updated] = await tx<WorkflowStepRow[]>`
      UPDATE workflow_steps
      SET status = ${params.decision === 'approved' ? 'approved' : 'rejected'},
          completed_at = NOW()
      WHERE id = ${params.stepId}
      RETURNING *
    `;

    if (params.comment) {
      await tx`
        INSERT INTO comments (tenant_id, document_id, author_id, body)
        VALUES (${params.tenantId}, ${step.documentId}, ${params.userId}, ${params.comment})
      `;
    }

    if (params.decision === 'rejected') {
      await tx`
        UPDATE workflow_steps
        SET status = 'skipped'
        WHERE document_id = ${step.documentId} AND tenant_id = ${params.tenantId}
          AND status = 'pending'
      `;
      await tx`
        UPDATE documents SET status = 'rejected'
        WHERE id = ${step.documentId} AND tenant_id = ${params.tenantId}
      `;
    } else {
      const [nextStep] = await tx<WorkflowStepRow[]>`
        SELECT * FROM workflow_steps
        WHERE document_id = ${step.documentId} AND tenant_id = ${params.tenantId}
          AND step_order > ${step.stepOrder} AND status = 'pending'
        ORDER BY step_order ASC
        LIMIT 1
      `;

      if (nextStep) {
        await tx`
          UPDATE workflow_steps SET status = 'active'
          WHERE id = ${nextStep.id}
        `;
      } else {
        await tx`
          UPDATE documents SET status = 'approved'
          WHERE id = ${step.documentId} AND tenant_id = ${params.tenantId}
        `;
      }
    }

    return updated;
  });
}

export async function getPendingSteps(
  userId: string,
  tenantId: string
): Promise<WorkflowStepWithUser[]> {
  return sql<WorkflowStepWithUser[]>`
    SELECT ws.*,
           u.full_name AS assignee_name,
           u.email AS assignee_email,
           d.doc_number,
           d.title AS doc_title,
           p.name AS project_name
    FROM workflow_steps ws
    JOIN users u ON u.id = ws.assignee_id
    JOIN documents d ON d.id = ws.document_id
    JOIN projects p ON p.id = d.project_id
    WHERE ws.assignee_id = ${userId}
      AND ws.tenant_id = ${tenantId}
      AND ws.status = 'active'
    ORDER BY ws.created_at ASC
  `;
}

export async function getDocumentWorkflow(
  documentId: string,
  tenantId: string
): Promise<WorkflowStepWithUser[]> {
  return sql<WorkflowStepWithUser[]>`
    SELECT ws.*,
           u.full_name AS assignee_name,
           u.email AS assignee_email,
           d.doc_number,
           d.title AS doc_title,
           p.name AS project_name
    FROM workflow_steps ws
    JOIN users u ON u.id = ws.assignee_id
    JOIN documents d ON d.id = ws.document_id
    JOIN projects p ON p.id = d.project_id
    WHERE ws.document_id = ${documentId}
      AND ws.tenant_id = ${tenantId}
    ORDER BY ws.step_order ASC
  `;
}
