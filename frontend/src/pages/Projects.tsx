// frontend/src/pages/Projects.tsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FolderKanban, FileText, Send, Activity, X, Loader2,
  MoreVertical, Pencil, Trash2, AlertTriangle,
} from 'lucide-react';
import { projectsApi } from '../api/client';
import type { Project } from '../types/index';

const STATUS_COLORS: Record<Project['status'], string> = {
  active: 'bg-green-100 text-green-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  archived: 'bg-gray-100 text-gray-500',
};

// ─── Create Project Modal ────────────────────────────────────────────────────

interface CreateProjectFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => projectsApi.create({ code, name, description, clientName }),
    onSuccess,
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string; error?: string; issues?: { message: string }[] } }; message?: string };
      const msg =
        axiosErr?.response?.data?.message ??
        axiosErr?.response?.data?.error ??
        axiosErr?.response?.data?.issues?.[0]?.message ??
        axiosErr?.message ??
        'Failed to create project';
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code * <span className="text-xs text-gray-400">(e.g. PRJ-001)</span>
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PRJ-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="ACME Corp"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cooling Tower Upgrade"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !code || !name}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Edit Project Modal ──────────────────────────────────────────────────────

interface EditProjectFormProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

const EditProjectForm: React.FC<EditProjectFormProps> = ({ project, onClose, onSuccess }) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [clientName, setClientName] = useState(project.clientName ?? '');
  const [status, setStatus] = useState<Project['status']>(project.status);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => projectsApi.update(project.id, { name, description, clientName, status }),
    onSuccess,
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const msg =
        axiosErr?.response?.data?.message ??
        axiosErr?.response?.data?.error ??
        axiosErr?.message ??
        'Failed to update project';
      setError(msg);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Project</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{project.code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="ACME Corp"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Project['status'])}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirmation ─────────────────────────────────────────────────────

interface DeleteConfirmProps {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}

const DeleteConfirm: React.FC<DeleteConfirmProps> = ({ project, onClose, onSuccess }) => {
  const mutation = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Delete Project</h2>
              <p className="text-sm text-gray-500">This cannot be undone.</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            You are about to delete <span className="font-semibold">{project.name}</span>{' '}
            <span className="font-mono text-xs text-blue-700">({project.code})</span> and all its documents.
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Project Card ────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project: p, onEdit, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-lg transition-all duration-150 group">
      {/* Three-dot menu */}
      <div className="absolute top-3 right-3">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
        >
          <MoreVertical className="h-4 w-4 text-gray-500" />
        </button>
        {menuOpen && (
          <>
            {/* Click-away overlay */}
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36 overflow-hidden">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(p); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5 text-gray-400" />
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(p); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {p.code}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[p.status]}`}>
              {p.status.replace(/_/g, ' ')}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">
            {p.name}
          </h3>
          {p.clientName && (
            <p className="text-xs text-gray-500 mt-0.5">{p.clientName}</p>
          )}
        </div>
        <FolderKanban className="h-8 w-8 text-blue-100 group-hover:text-blue-200 transition-colors flex-shrink-0" />
      </div>

      {p.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{p.description}</p>
      )}

      <div className="border-t border-gray-100 pt-3 mt-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {p.documentCount ?? 0} docs
          </span>
          <span className="flex items-center gap-1">
            <Send className="h-3.5 w-3.5" />
            {p.openTransmittals ?? 0} open
          </span>
        </div>
        {p.lastActivity && (
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3" />
            {new Date(p.lastActivity).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Projects Page ───────────────────────────────────────────────────────────

export const ProjectsPage: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const active = projects.filter((p) => p.status === 'active');
  const other = projects.filter((p) => p.status !== 'active');

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FolderKanban className="h-14 w-14 mb-4 opacity-20" />
            <p className="text-lg font-medium">No projects yet</p>
            <p className="text-sm mt-1">Create your first project to get started</p>
          </div>
        )}

        {!isLoading && active.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Active ({active.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {active.map((p) => (
                <ProjectCard key={p.id} project={p} onEdit={setEditProject} onDelete={setDeleteProject} />
              ))}
            </div>
          </section>
        )}

        {!isLoading && other.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Other ({other.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {other.map((p) => (
                <ProjectCard key={p.id} project={p} onEdit={setEditProject} onDelete={setDeleteProject} />
              ))}
            </div>
          </section>
        )}
      </div>

      {showCreate && (
        <CreateProjectForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); refresh(); }}
        />
      )}

      {editProject && (
        <EditProjectForm
          project={editProject}
          onClose={() => setEditProject(null)}
          onSuccess={() => { setEditProject(null); refresh(); }}
        />
      )}

      {deleteProject && (
        <DeleteConfirm
          project={deleteProject}
          onClose={() => setDeleteProject(null)}
          onSuccess={() => { setDeleteProject(null); refresh(); }}
        />
      )}
    </div>
  );
};
