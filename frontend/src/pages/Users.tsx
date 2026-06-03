// frontend/src/pages/Users.tsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, X, Loader2, Pencil, Trash2, AlertTriangle,
  Shield, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, UserCheck,
} from 'lucide-react';
import { usersApi, authApi } from '../api/client';
import type { User } from '../types/index';

const PAGES = [
  { key: 'projects',     label: 'Projects' },
  { key: 'documents',    label: 'Documents' },
  { key: 'transmittals', label: 'Transmittals' },
  { key: 'mdr',          label: 'MDR' },
  { key: 'tasks',        label: 'Tasks' },
  { key: 'users',           label: 'Users' },
  { key: 'change_requests', label: 'Change Requests' },
];

const ROLES = ['admin', 'manager', 'engineer', 'user'] as const;

const ROLE_COLORS: Record<string, string> = {
  admin:    'bg-purple-100 text-purple-800',
  manager:  'bg-blue-100 text-blue-800',
  engineer: 'bg-green-100 text-green-800',
  user:   'bg-gray-100 text-gray-600',
};

// ─── Invite User Modal ────────────────────────────────────────────────────────

const InviteModal: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('engineer');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => usersApi.invite({ email, fullName, password, role }),
    onSuccess,
    onError: (err: unknown) => {
      const e = err as {
        response?: {
          data?: {
            message?: string;
            error?: string;
            issues?: { path: string[]; message: string }[];
          }
        };
        message?: string;
      };
      const issues = e?.response?.data?.issues;
      const first = issues?.[0];
      if (first) {
        const field = first.path.length > 0 ? `${first.path[0]}: ` : '';
        setError(`${field}${first.message}`);
      } else {
        setError(e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'Failed');
      }
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Invite Team Member</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@company.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Password *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                password && password.length < 6
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-gray-300'
              }`}
            />
            {password && password.length < 6 && (
              <p className="text-xs text-red-500 mt-1">
                Password must be at least 6 characters ({password.length}/6)
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !email || !fullName || password.length < 6}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Invite
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Edit User Modal ──────────────────────────────────────────────────────────

const EditUserModal: React.FC<{ user: User; onClose: () => void; onSuccess: () => void }> = ({ user, onClose, onSuccess }) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => usersApi.update(user.id, { fullName, role, password: password || undefined }),
    onSuccess,
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-md"><X className="h-5 w-5 text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as User['role'])} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password <span className="text-gray-400 font-normal">(leave blank to keep)</span></label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !fullName} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Permission Toggle ────────────────────────────────────────────────────────

const PermissionToggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-gray-700">{label}</span>
    <button onClick={() => onChange(!value)} className="flex items-center gap-1.5 text-sm">
      {value
        ? <ToggleRight className="h-6 w-6 text-blue-600" />
        : <ToggleLeft className="h-6 w-6 text-gray-300" />}
    </button>
  </div>
);

// ─── User Row with inline permissions + manager assignment ────────────────────

const UserRow: React.FC<{
  user: User;
  isSelf: boolean;
  currentUser: { id: string; role: string };
  managers: User[];
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
  onRefresh: () => void;
}> = ({ user, isSelf, currentUser, managers, onEdit, onDelete, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);
  // Local manager assignment state — initialised from the user prop
  const [localManagerId, setLocalManagerId] = useState<string | null>(user.managerId ?? null);
  const [savingManager, setSavingManager] = useState(false);

  // Keep in sync if parent refreshes
  React.useEffect(() => {
    setLocalManagerId(user.managerId ?? null);
  }, [user.managerId]);

  const isEmployeeRole = user.role === 'engineer' || user.role === 'user';

  const loadPerms = async () => {
    if (!expanded) {
      const data = await usersApi.get(user.id);
      setPerms(data.permissions ?? {});
    }
    setExpanded((v) => !v);
  };

  const savePerms = async () => {
    if (!perms) return;
    setSavingPerms(true);
    await usersApi.updatePermissions(user.id, perms);
    setSavingPerms(false);
    onRefresh();
  };

  const handleManagerChange = async (newManagerId: string | null) => {
    setSavingManager(true);
    try {
      await usersApi.update(user.id, { managerId: newManagerId });
      setLocalManagerId(newManagerId);
      onRefresh();
    } catch (e) {
      console.error('Failed to update manager assignment', e);
    } finally {
      setSavingManager(false);
    }
  };

  // Determine manager name for display
  const currentManagerName = localManagerId
    ? managers.find((m) => m.id === localManagerId)?.fullName ?? user.managerName ?? '—'
    : null;

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {user.fullName} {isSelf && <span className="text-xs text-blue-600">(you)</span>}
            </p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${ROLE_COLORS[user.role]}`}>
            {user.role}
          </span>
        </td>

        {/* Reports To column */}
        <td className="px-4 py-3">
          {isEmployeeRole ? (
            currentManagerName ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-700">
                <UserCheck className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                <span className="truncate max-w-[110px]">{currentManagerName}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">Unassigned</span>
            )
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>

        <td className="px-4 py-3 text-xs text-gray-500">
          {new Date(user.createdAt).toLocaleDateString('en-GB')}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={loadPerms}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <Shield className="h-3.5 w-3.5" />
              Permissions
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {currentUser.role === 'admin' && (
              <>
                <button onClick={() => onEdit(user)} className="p-1.5 hover:bg-gray-100 rounded-md">
                  <Pencil className="h-3.5 w-3.5 text-gray-500" />
                </button>
                {!isSelf && (
                  <button onClick={() => onDelete(user)} className="p-1.5 hover:bg-red-50 rounded-md">
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                )}
              </>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={5} className="px-4 pb-3">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 divide-y divide-gray-100">

              {/* ── Manager Assignment ─────────────────────────────────── */}
              {isEmployeeRole && (currentUser.role === 'admin' || currentUser.role === 'manager') && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1">
                    Manager Assignment
                  </p>
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-gray-700 flex-shrink-0 mr-4">Reports to</span>

                    {/* Admin: full dropdown of all managers */}
                    {currentUser.role === 'admin' && (
                      <div className="flex items-center gap-2">
                        <select
                          value={localManagerId ?? ''}
                          onChange={(e) => handleManagerChange(e.target.value || null)}
                          disabled={savingManager}
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
                        >
                          <option value="">— No manager —</option>
                          {managers.map((m) => (
                            <option key={m.id} value={m.id}>{m.fullName}</option>
                          ))}
                        </select>
                        {savingManager && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                      </div>
                    )}

                    {/* Manager: toggle themselves as the manager */}
                    {currentUser.role === 'manager' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {localManagerId === currentUser.id ? 'My direct report' : 'Not my report'}
                        </span>
                        <button
                          onClick={() =>
                            handleManagerChange(
                              localManagerId === currentUser.id ? null : currentUser.id
                            )
                          }
                          disabled={savingManager}
                          className="flex items-center disabled:opacity-50"
                        >
                          {localManagerId === currentUser.id
                            ? <ToggleRight className="h-6 w-6 text-blue-600" />
                            : <ToggleLeft className="h-6 w-6 text-gray-300" />
                          }
                        </button>
                        {savingManager && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Page Permissions ───────────────────────────────────── */}
              {perms && currentUser.role === 'admin' && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1">
                    Page Access — overrides role defaults
                  </p>
                  {PAGES.map((page) => (
                    <PermissionToggle
                      key={page.key}
                      label={page.label}
                      value={perms[page.key] ?? false}
                      onChange={(v) => setPerms({ ...perms, [page.key]: v })}
                    />
                  ))}
                  <div className="py-3">
                    <button
                      onClick={savePerms}
                      disabled={savingPerms}
                      className="flex items-center gap-2 text-sm font-medium text-white bg-blue-600 px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingPerms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Save permissions
                    </button>
                  </div>
                </>
              )}

              {/* Manager expanded but no permissions UI (they can't edit page perms) */}
              {currentUser.role === 'manager' && (
                <p className="text-xs text-gray-400 italic py-3">
                  Page permission management is available to admins only.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Role Defaults Section ────────────────────────────────────────────────────

const RoleDefaultsSection: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<string>('manager');
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRolePerms = async (role: string) => {
    const data = await usersApi.getRolePermissions(role);
    setPerms(data);
    setSelectedRole(role);
  };

  React.useEffect(() => { loadRolePerms('manager'); }, []);

  const save = async () => {
    if (!perms) return;
    setSaving(true);
    await usersApi.updateRolePermissions(selectedRole, perms);
    setSaving(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-blue-600" />
        Role Default Permissions
      </h2>
      <div className="flex gap-2 mb-4">
        {(['admin', 'manager', 'engineer', 'user'] as const).map((r) => (
          <button
            key={r}
            onClick={() => loadRolePerms(r)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              selectedRole === r ? ROLE_COLORS[r] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {perms && (
        <div className="divide-y divide-gray-100">
          {PAGES.map((page) => (
            <PermissionToggle
              key={page.key}
              label={page.label}
              value={perms[page.key] ?? false}
              onChange={(v) => setPerms({ ...perms, [page.key]: v })}
            />
          ))}
          <div className="pt-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 text-sm font-medium text-white bg-blue-600 px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save {selectedRole} defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Users Page ───────────────────────────────────────────────────────────────

export const UsersPage: React.FC = () => {
  const [showInvite, setShowInvite] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.delete(deleteUser!.id),
    onSuccess: () => { setDeleteUser(null); queryClient.invalidateQueries({ queryKey: ['users'] }); },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  // Managers list (for the admin dropdown in manager assignment)
  const managers = (users as User[]).filter((u) => u.role === 'manager');

  // Only admins can see the full Users page management; managers see read-only + team assignment
  const isAdmin = me?.role === 'admin';

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team Members</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {(users as User[]).length} member{(users as User[]).length !== 1 ? 's' : ''} in your company
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Invite Member
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Role defaults card — admin only */}
        {isAdmin && <RoleDefaultsSection />}

        {/* Users table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name / Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reports To</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
              )}
              {!isLoading && (users as User[]).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No team members yet</td></tr>
              )}
              {(users as User[]).map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === me?.id}
                  currentUser={{ id: me?.id ?? '', role: me?.role ?? '' }}
                  managers={managers}
                  onEdit={setEditUser}
                  onDelete={setDeleteUser}
                  onRefresh={refresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); refresh(); }}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => { setEditUser(null); refresh(); }}
        />
      )}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Remove Member</p>
                <p className="text-sm text-gray-500">{deleteUser.fullName}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUser(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
