// Mirrors backend/src/common/enums/roles.enum.ts. Kept in sync by hand for
// now (no shared package) — in a larger monorepo this would live in a
// shared `@incident-mgmt/types` package imported by both apps instead of
// being duplicated.
export enum Role {
  ADMIN = 'admin',
  ON_CALL_ENGINEER = 'on_call_engineer',
  RESPONDER = 'responder',
  VIEWER = 'viewer',
}

export enum IncidentSeverity {
  SEV1 = 'sev1',
  SEV2 = 'sev2',
  SEV3 = 'sev3',
  SEV4 = 'sev4',
}

export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  IDENTIFIED = 'identified',
  MONITORING = 'monitoring',
  RESOLVED = 'resolved',
  POSTMORTEM = 'postmortem',
}

export enum IncidentEventType {
  CREATED = 'created',
  STATUS_CHANGE = 'status_change',
  SEVERITY_CHANGE = 'severity_change',
  ASSIGNMENT_CHANGE = 'assignment_change',
  COMMENT = 'comment',
  ATTACHMENT_ADDED = 'attachment_added',
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  reporter: User;
  owner: User | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface IncidentEvent {
  id: string;
  type: IncidentEventType;
  author: User;
  content: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: User;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
