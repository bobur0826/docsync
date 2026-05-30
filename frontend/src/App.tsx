// frontend/src/App.tsx

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, FileText, Send, TableProperties, FolderKanban,
  LogOut, CheckSquare, Users, Loader2, Building2, ChevronDown, Check,
} from 'lucide-react';
import { DocumentsPage } from './pages/Documents';
import { TransmittalsPage } from './pages/Transmittals';
import { MDRPage } from './pages/MDR';
import { ProjectsPage } from './pages/Projects';
import { TasksPage } from './pages/Tasks';
import { UsersPage } from './pages/Users';
import { getToken, clearToken, authApi } from './api/client';
import type { CompanyOption } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const ALL_NAV = [
  { to: '/projects',     icon: FolderKanban,   label: 'Projects',     key: 'projects' },
  { to: '/documents',    icon: FileText,        label: 'Documents',    key: 'documents' },
  { to: '/transmittals', icon: Send,            label: 'Transmittals', key: 'transmittals' },
  { to: '/mdr',          icon: TableProperties, label: 'MDR',          key: 'mdr' },
  { to: '/tasks',        icon: CheckSquare,     label: 'Tasks',        key: 'tasks' },
  { to: '/users',        icon: Users,           label: 'Users',        key: 'users' },
];

const ROLE_COLORS: Record<string, string> = {
  admin:    'bg-purple-100 text-purple-700',
  manager:  'bg-blue-100 text-blue-700',
  engineer: 'bg-green-100 text-green-700',
  user:     'bg-gray-100 text-gray-600',
};

// ─── Company Picker (shown at login when user belongs to multiple companies) ──

function CompanyPicker({
  companies,
  onPick,
}: {
  companies: CompanyOption[];
  onPick: (tenantId: string) => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Building2 className="h-10 w-10 text-blue-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Select a Company</h1>
          <p className="text-sm text-gray-500 mt-1">You have access to multiple companies</p>
        </div>
        <div className="space-y-3">
          {companies.map((c) => (
            <button
              key={c.tenantId}
              onClick={() => onPick(c.tenantId)}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{c.tenantName}</p>
                <p className="text-xs text-gray-500 capitalize">{c.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[] | null>(null);

  // Step 1: email + password submitted
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authApi.login(email, password);
      if (result.requiresCompanySelection && result.companies) {
        // Multiple companies — show picker
        setCompanies(result.companies);
      } else {
        window.location.href = '/projects';
      }
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: user picked a company
  const handlePickCompany = async (tenantId: string) => {
    setLoading(true);
    try {
      await authApi.login(email, password, tenantId);
      window.location.href = '/projects';
    } catch {
      setError('Failed to sign in to that company');
      setCompanies(null);
    } finally {
      setLoading(false);
    }
  };

  // Show company picker if needed
  if (companies) {
    return <CompanyPicker companies={companies} onPick={handlePickCompany} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <LayoutDashboard className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">DocSync<span className="text-blue-600">.uz</span></span>
          </div>
          <p className="text-gray-500 text-sm">Technical Document Management</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Company Switcher Dropdown (in sidebar) ───────────────────────────────────

function CompanySwitcher({ currentTenantId, currentTenantName }: { currentTenantId: string; currentTenantName: string }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const qc = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ['my-companies'],
    queryFn: authApi.myCompanies,
    staleTime: 60_000,
  });

  // Only show switcher if user belongs to more than one company
  if (companies.length <= 1) {
    return (
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <span className="text-lg font-bold text-gray-900 truncate">
            DocSync<span className="text-blue-600">.uz</span>
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5 pl-8">{currentTenantName}</p>
      </div>
    );
  }

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === currentTenantId) { setOpen(false); return; }
    setSwitching(true);
    try {
      await authApi.switchCompany(tenantId);
      qc.clear(); // clear all cached data for the old company
      window.location.href = '/projects';
    } catch {
      setSwitching(false);
    }
  };

  return (
    <div className="border-b border-gray-200 relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 flex items-center gap-2 hover:bg-gray-50 transition-colors"
      >
        <LayoutDashboard className="h-6 w-6 text-blue-600 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <span className="text-base font-bold text-gray-900">
            DocSync<span className="text-blue-600">.uz</span>
          </span>
          <p className="text-xs text-gray-500 truncate">{currentTenantName}</p>
        </div>
        {switching
          ? <Loader2 className="h-4 w-4 text-gray-400 animate-spin flex-shrink-0" />
          : <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-2 right-2 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <p className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Companies</p>
            {companies.map((c) => (
              <button
                key={c.tenantId}
                onClick={() => handleSwitch(c.tenantId)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.tenantName}</p>
                  <p className="text-xs text-gray-500 capitalize">{c.role}</p>
                </div>
                {c.tenantId === currentTenantId && (
                  <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    staleTime: 60_000,
  });

  const pages = me?.pages ?? {};
  const visibleNav = ALL_NAV.filter((item) => pages[item.key] !== false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">

        {/* Logo + company switcher */}
        {me
          ? <CompanySwitcher currentTenantId={me.tenantId} currentTenantName={me.tenantName ?? 'My Company'} />
          : (
            <div className="px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-6 w-6 text-blue-600" />
                <span className="text-lg font-bold text-gray-900">DocSync<span className="text-blue-600">.uz</span></span>
              </div>
            </div>
          )
        }

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
          )}
          {!isLoading && visibleNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info + sign out */}
        <div className="p-3 border-t border-gray-200 space-y-2">
          {me && (
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-gray-900 truncate">{me.fullName}</p>
              <p className="text-xs text-gray-500 truncate">{me.email}</p>
              <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[me.role] ?? 'bg-gray-100 text-gray-600'}`}>
                {me.role.charAt(0).toUpperCase() + me.role.slice(1)}
              </span>
            </div>
          )}
          <button
            onClick={() => { clearToken(); window.location.href = '/login'; }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

// ─── Permission Guard ─────────────────────────────────────────────────────────

function GuardedRoute({ pageKey, children }: { pageKey: string; children: React.ReactNode }) {
  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: 60_000 });

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  );

  if (me?.pages && me.pages[pageKey] === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Users className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm mt-1">You don't have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Protected Routes ─────────────────────────────────────────────────────────

function ProtectedRoutes() {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <AppShell>
      <Routes>
        <Route path="/projects"     element={<GuardedRoute pageKey="projects"><ProjectsPage /></GuardedRoute>} />
        <Route path="/documents"    element={<GuardedRoute pageKey="documents"><DocumentsPage /></GuardedRoute>} />
        <Route path="/transmittals" element={<GuardedRoute pageKey="transmittals"><TransmittalsPage /></GuardedRoute>} />
        <Route path="/mdr"          element={<GuardedRoute pageKey="mdr"><MDRPage /></GuardedRoute>} />
        <Route path="/tasks"        element={<GuardedRoute pageKey="tasks"><TasksPage /></GuardedRoute>} />
        <Route path="/users"        element={<GuardedRoute pageKey="users"><UsersPage /></GuardedRoute>} />
        <Route path="*"             element={<Navigate to="/projects" replace />} />
      </Routes>
    </AppShell>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*"     element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
