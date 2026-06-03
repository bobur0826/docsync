// frontend/src/pages/ChangeRequests.tsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, Plus, X, ChevronDown, Loader2,
  CheckCircle2, XCircle, Clock, AlertCircle, Trash2,
} from 'lucide-react';
import { changeRequestsApi, authApi, projectsApi } from '../api/client';
import type { ChangeRequest, ChangeRequestStatus, ChangeRequestCategory, TaskPriority } from '../types/index';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ChangeRequestStatus, string> = {
  pending:     'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  approved:    'bg-green-100 text-green-800',
  rejected:    'bg-red-100 text-red-800',
};

const STATUS_ICONS: Record<ChangeRequestStatus, React.ReactNode> = {
  pending:     <Clock className="h-3.5 w-3.5" />,
  in_progress: <Loader2 className="h-3.5 w-3.5" />,
  approved:    <CheckCircle2 className="h-3.5 w-3.5" />,
  rejected:    <XCircle className="h-3.5 w-3.5" />,
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const CATEGORY_LABELS: Record<ChangeRequestCategory, string> = {
  document:    'Document',
  transmittal: 'Transmittal',
  project:     'Project',
  system:      'System',
  other:       'Other',
};

const CATEGORY_COLORS: Record<ChangeRequestCategory, string> = {
  document:    'bg-indigo-100 text-indigo-700',
  transmittal: 'bg-teal-100 text-teal-700',
  project:     'bg-violet-100 text-violet-700',
  system:      'bg-amber-100 text-amber-700',
  other:       'bg-gray-100 text-gray-600',
};

const STATUS_FILTERS: { value: ChangeRequestStatus | ''; label: string }[] = [
  { value: '',            label: 'All' },
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'approved',    label: 'Approved' },
  { value: 'rejected',    label: 'Rejected' },
];

// ─── Create Modal ─────────────────────────────────────────────────────────────

const CreateModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const qc = useQueryClient();
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [category, setCategory]     = useState<ChangeRequestCategory>('other');
  const [priority, setPriority]     = useState<TaskPriority>('medium');
  const [projectId, setProjectId]   = useState('');
  const [error, setError]           = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () => changeRequestsApi.create({
      title, description, category, priority,
      projectId: projectId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-requests'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to submit request');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Change Request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the requested change"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ChangeRequestCategory)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(CATEGORY_LABELS) as ChangeRequestCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Project (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Related Project <span className="text-gray-400 font-normal">(optional)</span></label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              placeholder="Describe the change you are requesting and why it is needed…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !title.trim() || !description.trim()}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Review Modal ──────────────────────────────────────────────────────────────

const ReviewModal: React.FC<{
  cr: ChangeRequest;
  onClose: () => void;
}> = ({ cr, onClose }) => {
  const qc = useQueryClient();
  const [status, setStatus]     = useState<'in_progress' | 'approved' | 'rejected'>('approved');
  const [note, setNote]         = useState(cr.reviewNote ?? '');
  const [error, setError]       = useState('');

  const mutation = useMutation({
    mutationFn: () => changeRequestsApi.review(cr.id, {
      status,
      reviewNote: note || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-requests'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to update request');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Review Request</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-sm font-medium text-gray-900">{cr.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">by {cr.requestedByName ?? cr.requestedByEmail}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Decision *</label>
            <div className="flex gap-2">
              {(['in_progress', 'approved', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    status === s
                      ? s === 'approved'   ? 'bg-green-600 text-white border-green-600'
                      : s === 'rejected'   ? 'bg-red-600 text-white border-red-600'
                      :                      'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a note for the requester…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Saving…' : 'Save Decision'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Request Card ─────────────────────────────────────────────────────────────

const RequestCard: React.FC<{
  cr: ChangeRequest;
  canReview: boolean;
  currentUserId: string;
  onReview: (cr: ChangeRequest) => void;
  onDelete: (cr: ChangeRequest) => void;
}> = ({ cr, canReview, currentUserId, onReview, onDelete }) => {
  const createdDate = new Date(cr.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const isOwn = cr.requestedBy === currentUserId;
  const canDelete = isOwn && cr.status === 'pending';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate" title={cr.title}>
          {cr.title}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[cr.status]}`}>
            {STATUS_ICONS[cr.status]}
            {cr.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cr.category]}`}>
          {CATEGORY_LABELS[cr.category]}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_STYLES[cr.priority]}`}>
          {cr.priority}
        </span>
        {cr.projectCode && (
          <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
            {cr.projectCode}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 line-clamp-2 mb-3">{cr.description}</p>

      {/* Review note */}
      {cr.reviewNote && (
        <div className="bg-gray-50 border border-gray-200 rounded px-2.5 py-2 mb-3">
          <p className="text-xs text-gray-500 font-medium mb-0.5">Reviewer note</p>
          <p className="text-xs text-gray-700">{cr.reviewNote}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="text-xs text-gray-400">
          <span className="text-gray-600 font-medium">{cr.requestedByName ?? cr.requestedByEmail}</span>
          {' · '}{createdDate}
        </div>
        <div className="flex items-center gap-1">
          {canReview && (cr.status === 'pending' || cr.status === 'in_progress') && (
            <button
              onClick={() => onReview(cr)}
              className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors font-medium"
            >
              Review
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(cr)}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ChangeRequestsPage: React.FC = () => {
  const qc                                        = useQueryClient();
  const [statusFilter, setStatusFilter]           = useState<ChangeRequestStatus | ''>('');
  const [page, setPage]                           = useState(1);
  const [showCreate, setShowCreate]               = useState(false);
  const [reviewing, setReviewing]                 = useState<ChangeRequest | null>(null);
  const PAGE_SIZE                                 = 20;

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: 60_000 });

  const { data, isLoading } = useQuery({
    queryKey: ['change-requests', { statusFilter, page }],
    queryFn: () => changeRequestsApi.list({
      status:   statusFilter || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => changeRequestsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['change-requests'] }),
  });

  const handleDelete = (cr: ChangeRequest) => {
    if (confirm(`Delete "${cr.title}"? This cannot be undone.`)) {
      deleteMutation.mutate(cr.id);
    }
  };

  const role = me?.role ?? 'user';
  const canReview = role === 'admin' || role === 'manager';
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  // Pending count badge for admins/managers
  const pendingCount = (data?.rows ?? []).filter((r) => r.status === 'pending').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Change Requests</h1>
            {canReview && pendingCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 bg-yellow-500 text-white text-xs font-bold rounded-full">
                {pendingCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
        </div>

        {/* Role info banner */}
        {!canReview && (
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            Your requests are sent to your manager and company admins for review.
          </div>
        )}

        {/* Status filters */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === f.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && data && data.rows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <ClipboardList className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No change requests</p>
            <p className="text-sm mt-1">
              {statusFilter ? 'Try a different status filter' : 'Submit a request using the button above'}
            </p>
          </div>
        )}

        {!isLoading && data && data.rows.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.rows.map((cr) => (
                <RequestCard
                  key={cr.id}
                  cr={cr}
                  canReview={canReview}
                  currentUserId={me?.id ?? ''}
                  onReview={setReviewing}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {reviewing  && <ReviewModal cr={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
};
