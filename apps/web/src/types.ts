export type Department = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  departmentId: string;
  department?: Department;
  createdAt: string;
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
  payments?: Array<{ id: string; amount: string; method?: string | null; paymentDate: string }>;
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

export type Lead = {
  id: string;
  title: string;
  source?: string | null;
  status: string;
  value?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  departmentId?: string | null;
  department?: Department | null;
  customerId?: string | null;
  customer?: Customer | null;
  createdAt: string;
};

export type Estimate = {
  id: string;
  number: string;
  status: string;
  total: string;
  currency: string;
  notes?: string | null;
  departmentId: string;
  department?: Department;
  customerId?: string | null;
  customer?: Customer | null;
  convertedInvoiceId?: string | null;
  createdAt: string;
};

export type TicketReply = {
  id: string;
  body: string;
  internal: boolean;
  author?: { firstName: string; lastName: string; email: string } | null;
  createdAt: string;
};

export type Ticket = {
  id: string;
  subject: string;
  message?: string | null;
  status: string;
  priority: string;
  departmentId: string;
  department?: Department;
  customer?: Customer | null;
  replies?: TicketReply[];
  createdAt: string;
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  slug: string;
  content: string;
  category?: string | null;
  published: boolean;
  createdAt: string;
};

export type Contract = {
  id: string;
  subject: string;
  value?: string | null;
  status: string;
  departmentId: string;
  department?: Department;
  customer?: Customer | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
};

export type Subscription = {
  id: string;
  name: string;
  amount: string;
  currency: string;
  interval: string;
  status: string;
  nextBillingDate: string;
  departmentId: string;
  department?: Department;
  customer?: Customer | null;
  createdAt: string;
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

export type CustomField = {
  id: string;
  name: string;
  label: string;
  entityType: string;
  fieldType: string;
  required: boolean;
  options?: any;
  sortOrder: number;
  createdAt: string;
};

export type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
};
