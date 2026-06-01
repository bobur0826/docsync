// frontend/src/components/UploadDocumentModal.tsx

import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi, projectsApi } from '../api/client';

interface Props {
  onClose: () => void;
}

const DISCIPLINES = ['Civil', 'Structural', 'Mechanical', 'Electrical', 'Instrumentation', 'Piping', 'Process', 'Architecture', 'HVAC'];
const DOC_TYPES = ['Drawing', 'Specification', 'Datasheet', 'Report', 'Procedure', 'Manual', 'Schedule', 'Calculation', 'Correspondence'];

export const UploadDocumentModal: React.FC<Props> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [projectId, setProjectId] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [docType, setDocType] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      const fd = new FormData();
      fd.append('projectId', projectId);
      fd.append('docNumber', docNumber);
      fd.append('title', title);
      fd.append('discipline', discipline);
      fd.append('docType', docType);
      if (changeNote) fd.append('changeNote', changeNote);
      fd.append('file', file); // file must come last for multipart parsing
      return documentsApi.create(fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string; error?: string } } })
        ?.response?.data?.message
        ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err as Error)?.message
        ?? 'Upload failed';
      setError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!projectId) { setError('Select a project'); return; }
    if (!docNumber) { setError('Document number is required'); return; }
    if (!title) { setError('Title is required'); return; }
    if (!discipline) { setError('Discipline is required'); return; }
    if (!docType) { setError('Document type is required'); return; }
    if (!file) { setError('Please select a file'); return; }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upload Document</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doc Number *</label>
              <input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="EWE-CIV-DWG-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discipline *</label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="General Arrangement Drawing"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type *</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select type...</option>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Change Note</label>
            <input
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder="Initial issue"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
              accept=".pdf,.dwg,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-lg px-4 py-6 flex flex-col items-center gap-2 transition-colors ${
                file ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
            >
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700">{file.name}</span>
                  <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-gray-400" />
                  <span className="text-sm text-gray-600">Click to select file</span>
                  <span className="text-xs text-gray-400">PDF, DWG, DOC, XLS, images</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
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
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {mutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};
