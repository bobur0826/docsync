// frontend/src/components/DocumentCard.tsx

import React from 'react';
import { FileText, Clock } from 'lucide-react';
import type { Document } from '../types/index';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  superseded: 'bg-purple-100 text-purple-800',
  for_construction: 'bg-blue-100 text-blue-800',
  for_information: 'bg-sky-100 text-sky-800',
};

const MDR_STYLES: Record<string, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-yellow-500 text-white',
  C: 'bg-orange-500 text-white',
  D: 'bg-red-500 text-white',
};

const DISCIPLINE_COLORS: Record<string, string> = {
  Civil: 'bg-amber-100 text-amber-800',
  Structural: 'bg-indigo-100 text-indigo-800',
  Mechanical: 'bg-cyan-100 text-cyan-800',
  Electrical: 'bg-yellow-100 text-yellow-800',
  Instrumentation: 'bg-pink-100 text-pink-800',
  Piping: 'bg-teal-100 text-teal-800',
  Process: 'bg-violet-100 text-violet-800',
};

interface Props {
  document: Document;
  onClick: (doc: Document) => void;
}

export const DocumentCard: React.FC<Props> = ({ document: doc, onClick }) => {
  const disciplineColor =
    DISCIPLINE_COLORS[doc.discipline] ?? 'bg-gray-100 text-gray-700';
  const statusStyle = STATUS_STYLES[doc.status] ?? 'bg-gray-100 text-gray-700';
  const updatedDate = new Date(doc.updatedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <button
      onClick={() => onClick(doc)}
      className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <FileText className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {doc.docNumber}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${disciplineColor}`}>
              {doc.discipline}
            </span>
            {doc.mdrStatus && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${MDR_STYLES[doc.mdrStatus]}`}>
                {doc.mdrStatus}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 truncate" title={doc.title}>
            {doc.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{doc.docType}</p>
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle}`}>
              {doc.status.replace(/_/g, ' ')}
            </span>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span className="font-medium text-gray-600">Rev {doc.currentVersion}</span>
              <span>·</span>
              <Clock className="h-3 w-3" />
              <span>{updatedDate}</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};
