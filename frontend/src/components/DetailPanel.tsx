// frontend/src/components/DetailPanel.tsx

import React, { useState } from 'react';
import { X, Download, CheckCircle, XCircle, MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, workflowsApi } from '../api/client';
import { WorkflowStepper } from './WorkflowStepper';
import { AISummary } from './AISummary';
import type { Document } from '../types/index';

interface Props {
  document: Document;
  onClose: () => void;
  currentUserId: string;
}

export const DetailPanel: React.FC<Props> = ({ document: doc, onClose, currentUserId }) => {
  const [comment, setComment] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const queryClient = useQueryClient();

  const { data: fullDoc } = useQuery({
    queryKey: ['document', doc.id],
    queryFn: () => documentsApi.get(doc.id),
    initialData: doc as ReturnType<typeof documentsApi.get> extends Promise<infer T> ? T : never,
  });

  const { data: workflow = [] } = useQuery({
    queryKey: ['workflow', doc.id],
    queryFn: () => workflowsApi.getForDocument(doc.id),
  });

  const activeStep = workflow.find(
    (s) => s.status === 'active' && s.assigneeId === currentUserId
  );

  const approveMutation = useMutation({
    mutationFn: (params: { decision: 'approved' | 'rejected'; comment?: string }) =>
      workflowsApi.complete(activeStep!.id, params.decision, params.comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', doc.id] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setComment('');
    },
  });

  const handleDecision = (decision: 'approved' | 'rejected') => {
    if (!activeStep) return;
    approveMutation.mutate({ decision, comment: comment || undefined });
  };

  const versions = (fullDoc as Document & { versions?: { id: string; version: string; fileName: string; downloadUrl?: string; createdAt: string; fileSize: number }[] })?.versions ?? [];

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl border-l border-gray-200 flex flex-col z-50 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="min-w-0">
          <p className="text-xs font-mono text-blue-600 font-semibold">{doc.docNumber}</p>
          <h2 className="text-sm font-semibold text-gray-900 truncate" title={doc.title}>
            {doc.title}
          </h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-200 transition-colors flex-shrink-0">
          <X className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Metadata</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              ['Discipline', doc.discipline],
              ['Type', doc.docType],
              ['Revision', doc.currentVersion],
              ['Status', doc.status.replace(/_/g, ' ')],
              ['MDR Status', doc.mdrStatus ?? '—'],
              ['Updated', new Date(doc.updatedAt).toLocaleDateString('en-GB')],
            ].map(([label, value]) => (
              <React.Fragment key={label}>
                <dt className="text-gray-500">{label}</dt>
                <dd className="font-medium text-gray-900 capitalize">{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </section>

        <section>
          <AISummary documentId={doc.id} initialSummary={doc.aiSummary} />
        </section>

        <section>
          <button
            onClick={() => setShowVersions((v) => !v)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
          >
            <span>Version History ({versions.length})</span>
            {showVersions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showVersions && (
            <ul className="space-y-1.5">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-md px-3 py-2">
                  <div>
                    <span className="font-mono font-semibold text-blue-700">Rev {v.version}</span>
                    <span className="text-gray-500 mx-2">·</span>
                    <span className="text-gray-600 text-xs">{v.fileName}</span>
                    <span className="text-gray-400 text-xs ml-2">({formatBytes(v.fileSize)})</span>
                  </div>
                  {v.downloadUrl && (
                    <a
                      href={v.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-blue-100 rounded transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4 text-blue-600" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Approval Workflow
          </h3>
          <WorkflowStepper steps={workflow} />
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Add Comment
          </h3>
          <div className="flex gap-2">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="self-end p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>

      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex gap-3">
          {activeStep ? (
            <>
              <button
                onClick={() => handleDecision('approved')}
                disabled={approveMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={() => handleDecision('rejected')}
                disabled={approveMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </>
          ) : (
            versions[0]?.downloadUrl && (
              <a
                href={versions[0].downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Latest
              </a>
            )
          )}
        </div>
        {approveMutation.isError && (
          <p className="text-xs text-red-600 mt-2">
            {(approveMutation.error as Error)?.message ?? 'An error occurred'}
          </p>
        )}
      </div>
    </div>
  );
};
