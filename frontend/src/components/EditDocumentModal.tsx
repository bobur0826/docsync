// frontend/src/components/EditDocumentModal.tsx

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { documentsApi } from '../api/client';
import type { Document } from '../types/index';

const DISCIPLINES = ['Civil', 'Structural', 'Mechanical', 'Electrical', 'Instrumentation', 'Piping', 'Process'];
const DOC_TYPES = ['Drawing', 'Specification', 'Report', 'Procedure', 'Manual', 'Datasheet', 'Calculation', 'Schedule'];

interface Props {
  document: Document;
  onClose: () => void;
  onSaved: (doc: Document) => void;
}

export const EditDocumentModal: React.FC<Props> = ({ document: doc, onClose, onSaved }) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(doc.title);
  const [discipline, setDiscipline] = useState(doc.discipline);
  const [docType, setDocType] = useState(doc.docType);
  const [currentVersion, setCurrentVersion] = useState(doc.currentVersion);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      documentsApi.update(doc.id, { title, discipline, docType, currentVersion }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onSaved(updated);
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Failed to save changes');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
            {doc.docNumber}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discipline *</label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doc Type *</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Revision Name *</label>
            <input
              value={currentVersion}
              onChange={(e) => setCurrentVersion(e.target.value)}
              placeholder="e.g. A, B, Rev1, P1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">The current revision label shown on the document card</p>
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
            disabled={mutation.isPending || !title.trim() || !currentVersion.trim()}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
