// frontend/src/pages/Transmittals.tsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Send, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, FileText,
} from 'lucide-react';
import { transmittalsApi } from '../api/client';
import { TransmittalForm } from '../components/TransmittalForm';
import type { Transmittal } from '../types/index';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  responded: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
};

const PURPOSE_LABELS: Record<string, string> = {
  for_review: 'For Review',
  for_construction: 'For Construction',
  for_information: 'For Information',
  for_approval: 'For Approval',
};

const TransmittalRow: React.FC<{
  transmittal: Transmittal;
  onSend?: (id: string) => void;
  sending?: boolean;
}> = ({ transmittal: t, onSend, sending }) => (
  <div className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
    <div className="flex-shrink-0 mt-0.5">
      {t.direction === 'outgoing'
        ? <ArrowUpRight className="h-4 w-4 text-blue-500" />
        : <ArrowDownLeft className="h-4 w-4 text-green-500" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs font-semibold text-gray-800">{t.transmittalNo}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[t.status]}`}>
          {t.status}
        </span>
        <span className="text-xs text-gray-500">{PURPOSE_LABELS[t.purpose]}</span>
      </div>
      <p className="text-sm text-gray-800 mt-0.5 font-medium truncate">
        {t.subject ?? t.recipientName}
      </p>
      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
        <span>{t.recipientName}</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        {t.sentAt && (
          <>
            <span>·</span>
            <span className="flex items-center gap-1 text-blue-600">
              <Send className="h-3 w-3" />
              Sent {new Date(t.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </span>
          </>
        )}
        {t.respondedAt && (
          <>
            <span>·</span>
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Responded
            </span>
          </>
        )}
      </div>
    </div>
    {t.status === 'draft' && t.direction === 'outgoing' && onSend && (
      <button
        onClick={() => onSend(t.id)}
        disabled={sending}
        className="flex-shrink-0 flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        <Send className="h-3 w-3" />
        Send
      </button>
    )}
  </div>
);

export const TransmittalsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [outgoingPage, setOutgoingPage] = useState(1);
  const [incomingPage, setIncomingPage] = useState(1);
  const PAGE_SIZE = 10;
  const queryClient = useQueryClient();

  const { data: outgoing, isLoading: loadingOut } = useQuery({
    queryKey: ['transmittals', 'outgoing', outgoingPage],
    queryFn: () => transmittalsApi.list({ direction: 'outgoing', page: outgoingPage, pageSize: PAGE_SIZE }),
  });

  const { data: incoming, isLoading: loadingIn } = useQuery({
    queryKey: ['transmittals', 'incoming', incomingPage],
    queryFn: () => transmittalsApi.list({ direction: 'incoming', page: incomingPage, pageSize: PAGE_SIZE }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => transmittalsApi.send(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transmittals'] }),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-200 bg-white flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Transmittals</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Transmittal
        </button>
      </div>

      <div className="flex-1 grid grid-cols-2 divide-x divide-gray-200 overflow-hidden">
        <div className="flex flex-col overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-700">Outgoing</span>
            {outgoing && (
              <span className="ml-auto text-xs text-gray-500">{outgoing.total} total</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingOut && (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            )}
            {!loadingOut && outgoing?.rows.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <FileText className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No outgoing transmittals</p>
              </div>
            )}
            {outgoing?.rows.map((t) => (
              <TransmittalRow
                key={t.id}
                transmittal={t}
                onSend={(id) => sendMutation.mutate(id)}
                sending={sendMutation.isPending}
              />
            ))}
          </div>
          {outgoing && Math.ceil(outgoing.total / PAGE_SIZE) > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center bg-gray-50">
              <button
                onClick={() => setOutgoingPage((p) => Math.max(1, p - 1))}
                disabled={outgoingPage === 1}
                className="text-xs text-gray-600 px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-white transition-colors"
              >
                Prev
              </button>
              <span className="text-xs text-gray-500">Page {outgoingPage}</span>
              <button
                onClick={() => setOutgoingPage((p) => p + 1)}
                disabled={outgoingPage >= Math.ceil(outgoing.total / PAGE_SIZE)}
                className="text-xs text-gray-600 px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
            <span className="text-sm font-semibold text-gray-700">Incoming</span>
            {incoming && (
              <span className="ml-auto text-xs text-gray-500">{incoming.total} total</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingIn && (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            )}
            {!loadingIn && incoming?.rows.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <FileText className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No incoming transmittals</p>
              </div>
            )}
            {incoming?.rows.map((t) => (
              <TransmittalRow key={t.id} transmittal={t} />
            ))}
          </div>
          {incoming && Math.ceil(incoming.total / PAGE_SIZE) > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center bg-gray-50">
              <button
                onClick={() => setIncomingPage((p) => Math.max(1, p - 1))}
                disabled={incomingPage === 1}
                className="text-xs text-gray-600 px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-white transition-colors"
              >
                Prev
              </button>
              <span className="text-xs text-gray-500">Page {incomingPage}</span>
              <button
                onClick={() => setIncomingPage((p) => p + 1)}
                disabled={incomingPage >= Math.ceil(incoming.total / PAGE_SIZE)}
                className="text-xs text-gray-600 px-3 py-1.5 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <TransmittalForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['transmittals'] });
          }}
        />
      )}
    </div>
  );
};
