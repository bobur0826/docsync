// frontend/src/components/WorkflowStepper.tsx

import React from 'react';
import { CheckCircle, XCircle, Circle, Loader2, MinusCircle } from 'lucide-react';
import type { WorkflowStep } from '../types/index';

interface Props {
  steps: WorkflowStep[];
}

const StatusIcon: React.FC<{ status: WorkflowStep['status'] }> = ({ status }) => {
  switch (status) {
    case 'approved':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'active':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case 'skipped':
      return <MinusCircle className="h-5 w-5 text-gray-400" />;
    default:
      return <Circle className="h-5 w-5 text-gray-300" />;
  }
};

const statusLabel: Record<WorkflowStep['status'], string> = {
  pending: 'Pending',
  active: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  skipped: 'Skipped',
};

const statusTextColor: Record<WorkflowStep['status'], string> = {
  pending: 'text-gray-400',
  active: 'text-blue-600',
  approved: 'text-green-600',
  rejected: 'text-red-600',
  skipped: 'text-gray-400',
};

export const WorkflowStepper: React.FC<Props> = ({ steps }) => {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No workflow steps assigned.</p>
    );
  }

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => (
        <li key={step.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <StatusIcon status={step.status} />
            {index < steps.length - 1 && (
              <div className="w-px flex-1 bg-gray-200 my-1" />
            )}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">{step.stepName}</span>
              <span className={`text-xs font-medium ${statusTextColor[step.status]}`}>
                {statusLabel[step.status]}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate">
              {step.assigneeName ?? step.assigneeId}
            </p>
            {step.completedAt && (
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(step.completedAt).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
};
