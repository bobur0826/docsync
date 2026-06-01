// frontend/src/api/client.ts

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import type {
  User,
  Project,
  Document,
  DocumentVersion,
  Transmittal,
  TransmittalItem,
  WorkflowStep,
  PaginatedResponse,
  MdrStatus,
  Task,
} from '../types/index';

const TOKEN_KEY = 'docsync_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface CompanyOption {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: string;
}

export interface LoginResult {
  token?: string;
  userId?: string;
  tenantId?: string;
  requiresCompanySelection?: boolean;
  companies?: CompanyOption[];
}

export const authApi = {
  login: async (email: string, password: string, tenantId?: string): Promise<LoginResult> => {
    const res = await axiosInstance.post<LoginResult>('/auth/login', { email, password, tenantId });
    if (res.data.token) setToken(res.data.token);
    return res.data;
  },
  register: async (data: {
    tenantName: string;
    tenantSlug: string;
    email: string;
    password: string;
    fullName: string;
  }) => {
    const res = await axiosInstance.post<{ token: string; userId: string; tenantId: string }>(
      '/auth/register',
      data
    );
    setToken(res.data.token);
    return res.data;
  },
  me: async () => {
    const res = await axiosInstance.get<User & { tenantName: string }>('/auth/me');
    return res.data;
  },
  myCompanies: async (): Promise<CompanyOption[]> => {
    const res = await axiosInstance.get<CompanyOption[]>('/auth/my-companies');
    return res.data;
  },
  switchCompany: async (tenantId: string) => {
    const res = await axiosInstance.post<{ token: string; userId: string; tenantId: string }>(
      '/auth/switch',
      { tenantId }
    );
    setToken(res.data.token);
    return res.data;
  },
  logout: () => {
    clearToken();
    window.location.href = '/login';
  },
};

// ─── Projects ────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: async () => {
    const res = await axiosInstance.get<Project[]>('/projects');
    return res.data;
  },
  get: async (id: string) => {
    const res = await axiosInstance.get<Project>(`/projects/${id}`);
    return res.data;
  },
  create: async (data: { code: string; name: string; description?: string; clientName?: string }) => {
    const res = await axiosInstance.post<Project>('/projects', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Pick<Project, 'name' | 'description' | 'clientName' | 'status'>>) => {
    const res = await axiosInstance.patch<Project>(`/projects/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    await axiosInstance.delete(`/projects/${id}`);
  },
};

// ─── Documents ───────────────────────────────────────────────────────────────
export const documentsApi = {
  list: async (params?: {
    projectId?: string;
    status?: string;
    discipline?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const res = await axiosInstance.get<PaginatedResponse<Document>>('/documents', { params });
    return res.data;
  },
  get: async (id: string) => {
    const res = await axiosInstance.get<Document & { versions: (DocumentVersion & { downloadUrl: string })[] }>(
      `/documents/${id}`
    );
    return res.data;
  },
  create: async (formData: FormData) => {
    const res = await axiosInstance.post<{ document: Document; version: DocumentVersion }>(
      '/documents',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data;
  },
  uploadVersion: async (id: string, formData: FormData) => {
    const res = await axiosInstance.post<{ document: Document; version: DocumentVersion }>(
      `/documents/${id}/versions`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data;
  },
  updateStatus: async (id: string, status: Document['status']) => {
    const res = await axiosInstance.patch<Document>(`/documents/${id}/status`, { status });
    return res.data;
  },
  getVersions: async (id: string) => {
    const res = await axiosInstance.get<(DocumentVersion & { downloadUrl: string })[]>(
      `/documents/${id}/versions`
    );
    return res.data;
  },
  update: async (id: string, data: { title?: string; discipline?: string; docType?: string; currentVersion?: string }) => {
    const res = await axiosInstance.patch<Document>(`/documents/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    await axiosInstance.delete(`/documents/${id}`);
  },
  regenerateSummary: async (id: string) => {
    const res = await axiosInstance.post<{ summary: string }>(`/documents/${id}/ai-summary`);
    return res.data;
  },
  startWorkflow: async (
    id: string,
    steps: { assigneeId: string; stepName: string }[]
  ) => {
    const res = await axiosInstance.post<WorkflowStep[]>(`/documents/${id}/workflow`, { steps });
    return res.data;
  },
};

// ─── Transmittals ────────────────────────────────────────────────────────────
export const transmittalsApi = {
  list: async (params?: {
    projectId?: string;
    direction?: 'outgoing' | 'incoming';
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const res = await axiosInstance.get<PaginatedResponse<Transmittal>>('/transmittals', { params });
    return res.data;
  },
  get: async (id: string) => {
    const res = await axiosInstance.get<{ transmittal: Transmittal; items: TransmittalItem[] }>(
      `/transmittals/${id}`
    );
    return res.data;
  },
  create: async (data: {
    projectId: string;
    direction: 'outgoing' | 'incoming';
    purpose: Transmittal['purpose'];
    recipientName: string;
    recipientEmail: string;
    subject?: string;
    notes?: string;
    documentIds: string[];
  }) => {
    const res = await axiosInstance.post<{ transmittal: Transmittal; items: TransmittalItem[] }>(
      '/transmittals',
      data
    );
    return res.data;
  },
  send: async (id: string) => {
    const res = await axiosInstance.post<Transmittal>(`/transmittals/${id}/send`);
    return res.data;
  },
  respond: async (
    id: string,
    data: {
      responseNotes?: string;
      itemResponses: { documentId: string; responseCode: MdrStatus }[];
    }
  ) => {
    const res = await axiosInstance.post<Transmittal>(`/transmittals/${id}/respond`, data);
    return res.data;
  },
  update: async (id: string, data: {
    recipientName?: string;
    recipientEmail?: string;
    subject?: string;
    notes?: string;
    purpose?: Transmittal['purpose'];
  }) => {
    const res = await axiosInstance.patch<Transmittal>(`/transmittals/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    await axiosInstance.delete(`/transmittals/${id}`);
  },
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  list: async () => {
    const res = await axiosInstance.get<User[]>('/users');
    return res.data;
  },
  get: async (id: string) => {
    const res = await axiosInstance.get<User & { permissions: Record<string, boolean> }>(`/users/${id}`);
    return res.data;
  },
  invite: async (data: { email: string; fullName: string; password: string; role: string }) => {
    const res = await axiosInstance.post<User>('/users', data);
    return res.data;
  },
  update: async (id: string, data: { fullName?: string; role?: string; password?: string; managerId?: string | null }) => {
    const res = await axiosInstance.patch<User>(`/users/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    await axiosInstance.delete(`/users/${id}`);
  },
  updatePermissions: async (id: string, permissions: Record<string, boolean>) => {
    const res = await axiosInstance.put(`/users/${id}/permissions`, { permissions });
    return res.data;
  },
  getRolePermissions: async (role: string) => {
    const res = await axiosInstance.get<Record<string, boolean>>(`/users/permissions/role/${role}`);
    return res.data;
  },
  updateRolePermissions: async (role: string, permissions: Record<string, boolean>) => {
    const res = await axiosInstance.put(`/users/permissions/role/${role}`, { permissions });
    return res.data;
  },
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: async (params?: { projectId?: string; status?: string; assignedTo?: string }) => {
    const res = await axiosInstance.get<Task[]>('/tasks', { params });
    return res.data;
  },
  get: async (id: string) => {
    const res = await axiosInstance.get<Task>(`/tasks/${id}`);
    return res.data;
  },
  create: async (data: {
    title: string;
    description?: string;
    projectId?: string;
    assignedTo?: string;
    priority?: string;
    dueDate?: string;
  }) => {
    const res = await axiosInstance.post<Task>('/tasks', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Task>) => {
    const res = await axiosInstance.patch<Task>(`/tasks/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    await axiosInstance.delete(`/tasks/${id}`);
  },
};

// ─── Workflows ───────────────────────────────────────────────────────────────
export const workflowsApi = {
  getPending: async () => {
    const res = await axiosInstance.get<WorkflowStep[]>('/workflows/pending');
    return res.data;
  },
  getForDocument: async (documentId: string) => {
    const res = await axiosInstance.get<WorkflowStep[]>(`/workflows/document/${documentId}`);
    return res.data;
  },
  complete: async (stepId: string, decision: 'approved' | 'rejected', comment?: string) => {
    const res = await axiosInstance.post<WorkflowStep>(`/workflows/${stepId}/complete`, {
      decision,
      comment,
    });
    return res.data;
  },
};
