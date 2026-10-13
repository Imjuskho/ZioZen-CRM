export type Department = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  departmentId: string;
  department?: Department;
  createdAt: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  departmentId: string;
  department?: Department;
  project?: { id: string; name: string } | null;
  createdAt: string;
};

export type Invoice = {
  id: string;
  number: string;
  amount: string;
  status: string;
  currency: string;
  departmentId: string;
  department?: Department;
  createdAt: string;
};

export type UserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
  active: boolean;
  memberships: { department: { name: string } }[];
};

export type ReportSummary = {
  department: { id: string; name: string; slug: string };
  projects: number;
  tasks: number;
  customers: number;
  invoices: number;
  invoiceAmount: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  departmentId?: string | null;
  createdAt: string;
  actor?: { email: string } | null;
};
