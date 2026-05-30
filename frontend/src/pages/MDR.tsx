// frontend/src/pages/MDR.tsx

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { documentsApi, projectsApi } from '../api/client';
import type { Document } from '../types/index';

const STATUS_STYLE: Record<string, string> = {
  draft: 'text-gray-500',
  in_review: 'text-yellow-700 font-semibold',
  approved: 'text-green-700 font-semibold',
  rejected: 'text-red-700 font-semibold',
  superseded: 'text-purple-600',
  for_construction: 'text-blue-700 font-semibold',
  for_information: 'text-sky-700',
};

const MDR_BADGE: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-yellow-100 text-yellow-800',
  C: 'bg-orange-100 text-orange-800',
  D: 'bg-red-100 text-red-800',
};

const PAGE_SIZE = 25;

export const MDRPage: React.FC = () => {
  const [projectId, setProjectId] = useState('');
  const [page, setPage] = useState(1);
  const [discipline, setDiscipline] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['mdr', projectId, discipline, page],
    queryFn: () =>
      documentsApi.list({
        projectId: projectId || undefined,
        discipline: discipline || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!projectId,
    placeholderData: (prev) => prev,
  });

  const selectedProject = projects.find((p) => p.id === projectId);
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const exportToExcel = () => {
    if (!data) return;
    const rows = data.rows.map((d: Document) => ({
      'Document Number': d.docNumber,
      Title: d.title,
      Discipline: d.discipline,
      Type: d.docType,
      Revision: d.currentVersion,
      Status: d.status.replace(/_/g, ' '),
      'MDR Status': d.mdrStatus ?? '',
      'Last Updated': new Date(d.updatedAt).toLocaleDateString('en-GB'),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = [20, 50, 15, 20, 10, 20, 12, 15];
    ws['!cols'] = colWidths.map((w) => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MDR');
    XLSX.writeFile(wb, `MDR_${selectedProject?.code ?? 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const disciplines = [...new Set(data?.rows.map((d) => d.discipline) ?? [])].sort();

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Master Document Register</h1>
            <p className="text-sm text-gray-500 mt-0.5">MDR — complete document index by project</p>
          </div>
          <button
            onClick={exportToExcel}
            disabled={!data || data.rows.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-72">
            <select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setPage(1); setDiscipline(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a project to view MDR...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          {disciplines.length > 0 && (
            <select
              value={discipline}
              onChange={(e) => { setDiscipline(e.target.value); setPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Disciplines</option>
              {disciplines.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          {data && (
            <span className="text-sm text-gray-500 ml-auto">
              {data.total} document{data.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {!projectId && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FileSpreadsheet className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Select a project</p>
            <p className="text-sm mt-1">Choose a project above to load its MDR</p>
          </div>
        )}

        {projectId && isLoading && (
          <div className="p-6 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {projectId && !isLoading && data && (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
              <tr>
                {['Doc Number', 'Title', 'Discipline', 'Type', 'Rev', 'Status', 'MDR', 'Last Updated'].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-4 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.rows.map((doc) => (
                <tr key={doc.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">
                    {doc.docNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs">
                    <span className="block truncate" title={doc.title}>{doc.title}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{doc.discipline}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{doc.docType}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-center text-gray-800">{doc.currentVersion}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`capitalize ${STATUS_STYLE[doc.status] ?? 'text-gray-600'}`}>
                      {doc.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {doc.mdrStatus ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${MDR_BADGE[doc.mdrStatus]}`}>
                        {doc.mdrStatus}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(doc.updatedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {projectId && data && totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} · {data.total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
