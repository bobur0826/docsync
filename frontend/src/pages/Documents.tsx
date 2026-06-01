// frontend/src/pages/Documents.tsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Plus, X } from 'lucide-react';
import { documentsApi, authApi } from '../api/client';
import { DocumentCard } from '../components/DocumentCard';
import { DetailPanel } from '../components/DetailPanel';
import { UploadDocumentModal } from '../components/UploadDocumentModal';
import { EditDocumentModal } from '../components/EditDocumentModal';
import type { Document, DocumentStatus } from '../types/index';

const STATUS_FILTERS: { value: DocumentStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'for_construction', label: 'For Construction' },
];

const DISCIPLINES = ['', 'Civil', 'Structural', 'Mechanical', 'Electrical', 'Instrumentation', 'Piping', 'Process'];

export const DocumentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const [discipline, setDiscipline] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Document | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const queryClient = useQueryClient();
  const PAGE_SIZE = 24;

  const { data, isLoading } = useQuery({
    queryKey: ['documents', { search, status, discipline, page }],
    queryFn: () =>
      documentsApi.list({
        search: search || undefined,
        status: status || undefined,
        discipline: discipline || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setDiscipline('');
    setPage(1);
  };

  const hasFilters = !!search || !!status || !!discipline;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setSelected(null);
    },
  });

  const handleDelete = (doc: Document) => {
    if (confirm(`Delete "${doc.title}" (${doc.docNumber})? This cannot be undone.`)) {
      deleteMutation.mutate(doc.id);
    }
  };

  const role = currentUser?.role;
  const canEdit = role === 'admin' || role === 'manager' || role === 'engineer';
  const canDelete = role === 'admin' || role === 'manager';

  return (
    <div className="flex h-full relative">
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selected ? 'mr-[480px]' : ''}`}>
        <div className="px-6 py-5 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Documents</h1>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Upload Document
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by number or title..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <SlidersHorizontal className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <div className="flex gap-2 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatus(f.value); setPage(1); }}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    status === f.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <select
                value={discipline}
                onChange={(e) => { setDiscipline(e.target.value); setPage(1); }}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DISCIPLINES.map((d) => (
                  <option key={d} value={d}>{d || 'All Disciplines'}</option>
                ))}
              </select>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1.5"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && data && data.rows.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Search className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-lg font-medium">No documents found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}

          {!isLoading && data && data.rows.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.rows.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onClick={setSelected}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={setEditDoc}
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
      </div>

      {selected && currentUser && (
        <DetailPanel
          document={selected}
          onClose={() => setSelected(null)}
          currentUserId={currentUser.id}
        />
      )}

      {showUpload && (
        <UploadDocumentModal onClose={() => setShowUpload(false)} />
      )}

      {editDoc && (
        <EditDocumentModal
          document={editDoc}
          onClose={() => setEditDoc(null)}
          onSaved={(updated) => {
            if (selected?.id === updated.id) setSelected(updated);
          }}
        />
      )}
    </div>
  );
};
