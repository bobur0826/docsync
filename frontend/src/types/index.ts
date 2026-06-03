// frontend/src/types/index.ts

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  tenantName?: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager' | 'engineer' | 'user';
  createdAt: string;
  updatedAt: string;
  pages?: Record<string, boolean>; // returned by /me
  managerId?: string | null;       // which manager this user reports to
  managerName?: string | null;     // denormalised name for display
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  tenantId: string;
  projectId: string | null;
  projectName?: string | null;
  projectCode?: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string | null;
  assignedName?: string | null;
  createdBy: string;
  createdByName?: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  clientName: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
  openTransmittals?: number;
  lastActivity?: string | null;
}

export type DocumentStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'for_construction'
  | 'for_information';

export type MdrStatus = 'A' | 'B' | 'C' | 'D';

export interface Document {
  id: string;
  tenantId: string;
  projectId: string;
  docNumber: string;
  title: string;
  discipline: string;
  docType: string;
  currentVersion: string;
  status: DocumentStatus;
  mdrStatus: MdrStatus | null;
  aiSummary: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  versions?: DocumentVersion[];
}

export interface DocumentVersion {
  id: string;
  tenantId: string;
  documentId: string;
  version: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  changeNote: string | null;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string;
}

export type TransmittalStatus = 'draft' | 'sent' | 'responded' | 'closed';
export type TransmittalDirection = 'outgoing' | 'incoming';
export type TransmittalPurpose =
  | 'for_review'
  | 'for_construction'
  | 'for_information'
  | 'for_approval';

export interface Transmittal {
  id: string;
  tenantId: string;
  projectId: string;
  transmittalNo: string;
  direction: TransmittalDirection;
  purpose: TransmittalPurpose;
  status: TransmittalStatus;
  recipientName: string;
  recipientEmail: string;
  subject: string | null;
  notes: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  responseNotes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items?: TransmittalItem[];
}

export interface TransmittalItem {
  id: string;
  tenantId: string;
  transmittalId: string;
  documentId: string;
  documentVersionId: string;
  responseCode: 'A' | 'B' | 'C' | 'D' | null;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowStepStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'skipped';

export interface WorkflowStep {
  id: string;
  tenantId: string;
  documentId: string;
  stepOrder: number;
  assigneeId: string;
  status: WorkflowStepStatus;
  stepName: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeName?: string;
  assigneeEmail?: string;
  docNumber?: string;
  docTitle?: string;
  projectName?: string;
}

export interface Comment {
  id: string;
  tenantId: string;
  documentId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
}

export type ChangeRequestStatus   = 'pending' | 'in_progress' | 'approved' | 'rejected';
export type ChangeRequestCategory = 'document' | 'transmittal' | 'project' | 'system' | 'other';

export interface ChangeRequest {
  id: string;
  tenantId: string;
  projectId: string | null;
  projectName?: string | null;
  projectCode?: string | null;
  title: string;
  description: string;
  category: ChangeRequestCategory;
  priority: TaskPriority;
  status: ChangeRequestStatus;
  requestedBy: string;
  requestedByName?: string | null;
  requestedByEmail?: string | null;
  reviewedBy: string | null;
  reviewedByName?: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  issues?: { message: string; path: (string | number)[] }[];
}
