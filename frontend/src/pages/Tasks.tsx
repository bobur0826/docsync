// frontend/src/pages/Tasks.tsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, CheckSquare, Clock, Loader2, X, AlertTriangle,
  Trash2, Pencil, ChevronDown, User,
} from 'lucide-react';
import { tasksApi, projectsApi, usersApi } from '../api/client';
import { authApi } from '../api/client';
import type { Task, TaskStatus, TaskPriority } from '../types/index';

const STATUS_COLS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo',        label: 'To Do',       color: 'bg-gray-100 text-gray-700' },
  { key: 'in_progress', label: 'In Progress',  color: 'bg-blue-100 text-blue-700' },
  { key: 'review',      label: 'Review',       color: 'bg-yellow-100 text-yellow-700' },
  { key: 'done',        label: 'Done',         color: 'bg-green-100 text-green-700' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-blue-50 text-blue-600',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

// ─── Create / Edit Task Modal ─────────────────────────────────────────────────

interface TaskFormProps {
  task?: Task | null;
  onClose: () => void;
  onSuccess: () => void;
  currentUser: { id: string; role: string };
}

const TaskForm: React.FC<TaskFormProps> = ({ task, onClose, onSuccess, currentUser }) => {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [projectId, setProjectId] = useState(task?.projectId ?? '');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate?.slice(0, 10) ?? '');
  const [error, setError] = useState<string | null>(null);

  const canAssign = currentUser.role === 'admin' || currentUser.role === 'manager';

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: canAssign,
  });

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? tasksApi.update(task!.id, { title, description, projectId: projectId || undefined, assignedTo: assignedTo || undefined, priority, dueDate: dueDate || undefined })
      : tasksApi.create({ title, description, projectId: projectId || undefined, assignedTo: assignedTo || undefined, priority, dueDate: dueDate || undefined }),
    onSuccess,
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string; error?: string } }; message?: string };
      setError(e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'Failed');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— No project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>

          {canAssign && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Unassigned —</option>
                {(users as { id: string; fullName: string; role: string }[]).map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.role})</option>
                ))}
              </select>
            </div>
          )}

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
            disabled={mutation.isPending || !title}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  currentUserId: string;
  currentUserRole: string;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, currentUserId, currentUserRole, onEdit, onDelete, onStatusChange }) => {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  // Edit allowed: admin/manager always, engineer/user only on their own tasks
  const canEdit = currentUserRole === 'admin' || currentUserRole === 'manager'
    || task.assignedTo === currentUserId
    || task.createdBy === currentUserId;

  // Delete allowed: only admin and manager
  const canDelete = currentUserRole === 'admin' || currentUserRole === 'manager';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3.5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canEdit && (
            <button onClick={() => onEdit(task)} className="p-1 hover:bg-gray-100 rounded">
              <Pencil className="h-3.5 w-3.5 text-gray-500" />
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(task)} className="p-1 hover:bg-red-50 rounded">
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm font-medium text-gray-900 mb-1 leading-snug">{task.title}</p>

      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
        <div className="flex items-center gap-1">
          {task.assignedName ? (
            <>
              <User className="h-3 w-3" />
              <span className="truncate max-w-[90px]">{task.assignedName}</span>
            </>
          ) : (
            <span className="italic">Unassigned</span>
          )}
        </div>
        {task.dueDate && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
            <Clock className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>

      {task.projectCode && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
            {task.projectCode}
          </span>
        </div>
      )}

      {/* Quick status move */}
      <div className="mt-2 relative group/status">
        <button className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-600 pt-1">
          <span>Move to...</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        <div className="hidden group-hover/status:block absolute bottom-6 left-0 right-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {STATUS_COLS.filter((s) => s.key !== task.status).map((s) => (
            <button
              key={s.key}
              onClick={() => onStatusChange(task.id, s.key)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm ───────────────────────────────────────────────────────────

const DeleteTaskConfirm: React.FC<{ task: Task; onClose: () => void; onSuccess: () => void }> = ({ task, onClose, onSuccess }) => {
  const mutation = useMutation({ mutationFn: () => tasksApi.delete(task.id), onSuccess });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Delete Task</p>
            <p className="text-sm text-gray-500 truncate max-w-[200px]">"{task.title}"</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Kanban Board ─────────────────────────────────────────────────────────────

const KanbanBoard: React.FC<{
  tasks: Task[];
  me: { id: string; role: string };
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}> = ({ tasks, me, onEdit, onDelete, onStatusChange }) => {
  const grouped = STATUS_COLS.reduce((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <div className="flex gap-4 min-w-max">
      {STATUS_COLS.map((col) => (
        <div key={col.key} className="w-64 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${col.color}`}>
              {col.label}
            </span>
            <span className="text-xs text-gray-400 font-medium">{grouped[col.key].length}</span>
          </div>
          <div className="space-y-2 min-h-[120px]">
            {grouped[col.key].length === 0 && (
              <div className="border-2 border-dashed border-gray-200 rounded-lg h-24 flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-gray-200" />
              </div>
            )}
            {grouped[col.key].map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={me.id}
                currentUserRole={me.role}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Tasks Page ───────────────────────────────────────────────────────────────

export const TasksPage: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  // For managers: 'mine' | 'team'
  const [managerView, setManagerView] = useState<'mine' | 'team'>('mine');
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(),
    enabled: !!me,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => tasksApi.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });

  // Split tasks for admin and manager — both get "My Tasks" vs "Team Tasks" tabs
  // "My Tasks"   = tasks assigned to me (the work is mine to do)
  // "Team Tasks" = tasks assigned to someone else (I may have created them, but they belong to the team)
  const hasTabs   = me?.role === 'manager' || me?.role === 'admin';
  const myTasks   = tasks.filter((t) => t.assignedTo === me?.id);
  const teamTasks = tasks.filter((t) => t.assignedTo !== me?.id);
  const visibleTasks = hasTabs
    ? (managerView === 'mine' ? myTasks : teamTasks)
    : tasks;

  if (!me) return null;

  const loadingSkeleton = (
    <div className="flex gap-4">
      {STATUS_COLS.map((col) => (
        <div key={col.key} className="w-64 flex-shrink-0">
          <div className="h-8 bg-gray-100 rounded animate-pulse mb-3" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse mb-2" />
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {hasTabs
              ? `${myTasks.length} mine · ${teamTasks.length} team`
              : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} assigned to or created by you`
            }
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {/* Manager / Admin tab switcher */}
      {hasTabs && (
        <div className="px-6 pt-4 pb-0 bg-white border-b border-gray-200">
          <div className="flex gap-1">
            <button
              onClick={() => setManagerView('mine')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                managerView === 'mine'
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              My Tasks
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {myTasks.length}
              </span>
            </button>
            <button
              onClick={() => setManagerView('team')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                managerView === 'team'
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Team Tasks
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {teamTasks.length}
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-x-auto p-6">
        {isLoading ? loadingSkeleton : (
          <KanbanBoard
            tasks={visibleTasks}
            me={me}
            onEdit={setEditTask}
            onDelete={setDeleteTask}
            onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
          />
        )}
      </div>

      {showCreate && (
        <TaskForm
          currentUser={me}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); refresh(); }}
        />
      )}
      {editTask && (
        <TaskForm
          task={editTask}
          currentUser={me}
          onClose={() => setEditTask(null)}
          onSuccess={() => { setEditTask(null); refresh(); }}
        />
      )}
      {deleteTask && (
        <DeleteTaskConfirm
          task={deleteTask}
          onClose={() => setDeleteTask(null)}
          onSuccess={() => { setDeleteTask(null); refresh(); }}
        />
      )}
    </div>
  );
};
