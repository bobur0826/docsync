// frontend/src/components/AISummary.tsx

import React, { useState } from 'react';
import { RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { documentsApi } from '../api/client';

interface Props {
  documentId: string;
  initialSummary: string | null;
}

export const AISummary: React.FC<Props> = ({ documentId, initialSummary }) => {
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await documentsApi.regenerateSummary(documentId);
      setSummary(result.summary);
    } catch {
      setError('Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-purple-200 rounded-lg bg-purple-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">AI Summary</span>
          <span className="text-xs text-purple-500 font-normal">powered by Claude</span>
        </div>
        <button
          onClick={regenerate}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Generating...' : 'Regenerate'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && !summary && (
        <div className="flex items-center gap-2 text-sm text-purple-500">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
          </div>
          <span>Analyzing document...</span>
        </div>
      )}

      {summary && !loading && (
        <p className="text-sm text-purple-900 leading-relaxed">{summary}</p>
      )}

      {!summary && !loading && !error && (
        <p className="text-sm text-purple-400 italic">
          No summary yet. Click Regenerate to create one.
        </p>
      )}
    </div>
  );
};
