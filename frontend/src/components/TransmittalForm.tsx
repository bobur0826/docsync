// frontend/src/components/TransmittalForm.tsx

import React, { useState } from 'react';
import { X, Search, CheckSquare, Square, Send } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transmittalsApi, documentsApi, projectsApi } from '../api/client';
import type { Transmittal } from '../types/index';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const PURPOSE_OPTIONS: { value: Transmittal['purpose']; label: string }[] = [
  { value: 'for_review', label: 'For Review' },
  { value: 'for_construction', label: 'For Construction' },
  { value: 'for_information', label: 'For Information' },
  { value: 'for_approval', label: 'For Approval' },
];

export const TransmittalForm: React.FC<Props> = ({ onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing');
  const [purpose, setPurpose] = useState<Transmittal['purpose']>('for_review');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [docSearch, setDocSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const { data: docsData } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.list({ projectId, pageSize: 200 }),
    enabled: !!projectId,
  });

  const docs = docsData?.rows ?? [];
  const filteredDocs = docs.filter(
    (d) =>
      d.docNumber.toLowerCase().includes(docSearch.toLowerCase()) ||
      d.title.toLowerCase().includes(docSearch.toLowerCase())
  );

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: () =>
      transmittalsApi.create({
        projectId,
        direction,
        purpose,
        recipientName,
        recipientEmail,
        subject: subject || undefined,
        notes: notes || undefined,
        documentIds: Array.from(selectedDocIds),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transmittals'] });
      onCreated();
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create transmittal');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!projectId) { setError('Please select a project'); return; }
    if (!recipientName || !recipientEmail) { setError('Recipient name and email are required'); return; }
    if (selectedDocIds.size === 0) { setError('Select at least one document'); return; }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Transmittal</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
              <select
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setSelectedDocIds(new Set()); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Direction *</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {(['outgoing', 'incoming'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                      direction === d ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as Transmittal['purpose'])}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PURPOSE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name *</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="John Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email *</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Documents * {selectedDocIds.size > 0 && (
                <span className="ml-1 text-blue-600">({selectedDocIds.size} selected)</span>
              )}
            </label>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
                <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                {!projectId && (
                  <p className="text-sm text-gray-400 italic p-4 text-center">Select a project first</p>
                )}
                {projectId && filteredDocs.length === 0 && (
                  <p className="text-sm text-gray-400 italic p-4 text-center">No documents found</p>
                )}
                {filteredDocs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDoc(d.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors text-left"
                  >
                    {selectedDocIds.has(d.id)
                      ? <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      : <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-blue-700">{d.docNumber}</span>
                      <span className="mx-1 text-gray-400">·</span>
                      <span className="text-sm text-gray-800 truncate">{d.title}</span>
                    </div>
                    <span className="ml-auto text-xs font-medium text-gray-500 flex-shrink-0">
                      Rev {d.currentVersion}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
            {mutation.isPending ? 'Creating...' : 'Create Transmittal'}
          </button>
        </div>
      </div>
    </div>
  );
};
