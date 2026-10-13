import { useEffect, useState } from 'react';
import './App.css';
import { api, getToken, setToken } from './api';
import type {
  AuditEntry,
  Contract,
  Customer,
  Department,
  Estimate,
  Invoice,
  KnowledgeArticle,
  Lead,
  Project,
  ReportSummary,
  Subscription,
  Task,
  Ticket,
  UserRecord,
  CustomField,
  Webhook,
} from './types';

type AuthState = { token: string | null; email: string | null };
type View = 'overview' | 'workspace' | 'sales' | 'finance' | 'support' | 'admin' | 'system';

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ token: getToken(), email: localStorage.getItem('ziozen_email') });
  const [view, setView] = useState<View>('overview');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', company: '', departmentId: '' });
  const [newProject, setNewProject] = useState({ name: '', departmentId: '', customerId: '' });
  const [newTask, setNewTask] = useState({ title: '', departmentId: '', projectId: '', customerId: '' });
  const [newInvoice, setNewInvoice] = useState({ number: '', amount: '', departmentId: '' });
  const [newLead, setNewLead] = useState({ title: '', value: '', email: '', departmentId: '', source: 'Website' });
  const [newEstimate, setNewEstimate] = useState({ number: '', total: '', departmentId: '', customerId: '' });
  const [newTicket, setNewTicket] = useState({ subject: '', message: '', priority: 'normal', departmentId: '' });
  const [newContract, setNewContract] = useState({ subject: '', value: '', departmentId: '', customerId: '' });
  const [newSubscription, setNewSubscription] = useState({ name: '', amount: '', departmentId: '', customerId: '', interval: 'monthly' });
  const [newCustomField, setNewCustomField] = useState({ name: '', label: '', entityType: 'Customer', fieldType: 'TEXT' });
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', event: 'customer.created' });

  async function load() {
    try {
      setError(null);
      const [d, c, p, t, i, l, e, tick, kb, cont, subs] = await Promise.all([
        api<Department[]>('/departments'),
        api<Customer[]>('/customers'),
        api<Project[]>('/projects'),
        api<Task[]>('/tasks'),
        api<Invoice[]>('/invoices'),
        api<Lead[]>('/leads'),
        api<Estimate[]>('/estimates'),
        api<Ticket[]>('/tickets'),
        api<KnowledgeArticle[]>('/knowledge-base'),
        api<Contract[]>('/contracts'),
        api<Subscription[]>('/subscriptions'),
      ]);
      setDepartments(d);
      setCustomers(c);
      setProjects(p);
      setTasks(t);
      setInvoices(i);
      setLeads(l);
      setEstimates(e);
      setTickets(tick);
      setArticles(kb);
      setContracts(cont);
      setSubscriptions(subs);
      if (d[0] && !newCustomer.departmentId) setNewCustomer((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newProject.departmentId) setNewProject((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newTask.departmentId) setNewTask((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newInvoice.departmentId) setNewInvoice((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newLead.departmentId) setNewLead((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newEstimate.departmentId) setNewEstimate((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newTicket.departmentId) setNewTicket((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newContract.departmentId) setNewContract((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newSubscription.departmentId) setNewSubscription((s) => ({ ...s, departmentId: d[0].id }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function loadUsers() {
    try {
      setUsers(await api<UserRecord[]>('/users'));
    } catch {
      setUsers([]);
    }
  }

  async function loadAnalytics() {
    try {
      setReports(await api<ReportSummary[]>('/reports/department-summary'));
      setAuditEntries(await api<AuditEntry[]>('/audit-logs?limit=20'));
    } catch {
      setReports([]);
      setAuditEntries([]);
    }
  }

  async function loadExtensibility() {
    try {
      const [cf, wh] = await Promise.all([
        api<CustomField[]>('/custom-fields'),
        api<Webhook[]>('/webhooks'),
      ]);
      setCustomFields(cf);
      setWebhooks(wh);
    } catch {
      setCustomFields([]);
      setWebhooks([]);
    }
  }

  useEffect(() => {
    if (auth.token) {
      void load();
      void loadUsers();
      void loadAnalytics();
      void loadExtensibility();
    }
  }, [auth.token]);

  async function login(email: string, password: string) {
    const response = await api<{ accessToken: string }>('/auth/login', { method: 'POST', json: { email, password } });
    setToken(response.accessToken);
    localStorage.setItem('ziozen_email', email);
    setAuth({ token: response.accessToken, email });
  }

  async function logout() {
    setToken(null);
    localStorage.removeItem('ziozen_email');
    setAuth({ token: null, email: null });
    setDepartments([]);
    setCustomers([]);
    setProjects([]);
    setTasks([]);
    setInvoices([]);
    setUsers([]);
    setReports([]);
    setAuditEntries([]);
  }

  async function createCustomer(event: React.FormEvent) {
    event.preventDefault();
    await api('/customers', { method: 'POST', json: newCustomer });
    setNewCustomer((s) => ({ ...s, name: '', email: '', company: '' }));
    await load();
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    await api('/projects', {
      method: 'POST',
      json: {
        name: newProject.name,
        departmentId: newProject.departmentId,
        customerId: newProject.customerId || undefined,
      },
    });
    setNewProject((s) => ({ ...s, name: '', customerId: '' }));
    await load();
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    await api('/tasks', {
      method: 'POST',
      json: {
        title: newTask.title,
        departmentId: newTask.departmentId,
        projectId: newTask.projectId || undefined,
        customerId: newTask.customerId || undefined,
      },
    });
    setNewTask((s) => ({ ...s, title: '' }));
    await load();
  }

  async function createInvoice(event: React.FormEvent) {
    event.preventDefault();
    await api('/invoices', {
      method: 'POST',
      json: { number: newInvoice.number, amount: newInvoice.amount, departmentId: newInvoice.departmentId },
    });
    setNewInvoice((s) => ({ ...s, number: '', amount: '' }));
    await load();
  }

  async function recordPayment(invoiceId: string, currentAmount: string) {
    const amount = window.prompt(`Enter payment amount (Balance up to $${currentAmount}):`, currentAmount);
    if (!amount) return;
    try {
      setError(null);
      await api(`/invoices/${invoiceId}/payments`, {
        method: 'POST',
        json: { amount, method: 'manual', transactionId: `TX-${Date.now()}` },
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createLead(event: React.FormEvent) {
    event.preventDefault();
    await api('/leads', {
      method: 'POST',
      json: {
        title: newLead.title,
        value: newLead.value || undefined,
        email: newLead.email || undefined,
        departmentId: newLead.departmentId,
        source: newLead.source,
      },
    });
    setNewLead((s) => ({ ...s, title: '', value: '', email: '' }));
    await load();
  }

  async function convertLead(leadId: string, title: string) {
    await api(`/leads/${leadId}/convert`, {
      method: 'POST',
      json: { companyName: title, projectName: `${title} Project` },
    });
    await load();
  }

  async function createEstimate(event: React.FormEvent) {
    event.preventDefault();
    await api('/estimates', {
      method: 'POST',
      json: {
        number: newEstimate.number,
        departmentId: newEstimate.departmentId,
        customerId: newEstimate.customerId || undefined,
        items: [{ description: 'Main Service', rate: Number(newEstimate.total || 0), quantity: 1 }],
      },
    });
    setNewEstimate((s) => ({ ...s, number: '', total: '' }));
    await load();
  }

  async function convertEstimate(estimateId: string) {
    await api(`/estimates/${estimateId}/convert`, { method: 'POST' });
    await load();
  }

  async function createTicket(event: React.FormEvent) {
    event.preventDefault();
    await api('/tickets', {
      method: 'POST',
      json: {
        subject: newTicket.subject,
        message: newTicket.message || undefined,
        priority: newTicket.priority,
        departmentId: newTicket.departmentId,
      },
    });
    setNewTicket((s) => ({ ...s, subject: '', message: '' }));
    await load();
  }

  async function replyToTicket(ticketId: string, internal: boolean) {
    const text = window.prompt(internal ? 'Add internal staff note:' : 'Add public reply to customer:');
    if (!text) return;
    await api(`/tickets/${ticketId}/replies`, {
      method: 'POST',
      json: { body: text, internal },
    });
    await load();
  }

  async function createContract(event: React.FormEvent) {
    event.preventDefault();
    await api('/contracts', {
      method: 'POST',
      json: {
        subject: newContract.subject,
        value: newContract.value || undefined,
        departmentId: newContract.departmentId,
        customerId: newContract.customerId || undefined,
      },
    });
    setNewContract((s) => ({ ...s, subject: '', value: '' }));
    await load();
  }

  async function activateContract(contractId: string) {
    await api(`/contracts/${contractId}`, { method: 'PATCH', json: { status: 'active' } });
    await load();
  }

  async function createSubscription(event: React.FormEvent) {
    event.preventDefault();
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString();
    await api('/subscriptions', {
      method: 'POST',
      json: {
        name: newSubscription.name,
        amount: newSubscription.amount,
        interval: newSubscription.interval,
        nextBillingDate: nextMonth,
        departmentId: newSubscription.departmentId,
        customerId: newSubscription.customerId || undefined,
      },
    });
    setNewSubscription((s) => ({ ...s, name: '', amount: '' }));
    await load();
  }

  async function cancelSubscription(subId: string) {
    await api(`/subscriptions/${subId}`, { method: 'PATCH', json: { status: 'cancelled' } });
    await load();
  }

  async function updateUserRole(userId: string, role: UserRecord['role']) {
    await api(`/users/${userId}`, { method: 'PATCH', json: { role } });
    await loadUsers();
  }

  async function createCustomField(event: React.FormEvent) {
    event.preventDefault();
    await api('/custom-fields', {
      method: 'POST',
      json: {
        name: newCustomField.name,
        label: newCustomField.label,
        entityType: newCustomField.entityType,
        fieldType: newCustomField.fieldType,
      },
    });
    setNewCustomField({ name: '', label: '', entityType: 'Customer', fieldType: 'TEXT' });
    await loadExtensibility();
  }

  async function createWebhook(event: React.FormEvent) {
    event.preventDefault();
    await api('/webhooks', {
      method: 'POST',
      json: {
        name: newWebhook.name,
        url: newWebhook.url,
        events: [newWebhook.event],
      },
    });
    setNewWebhook({ name: '', url: '', event: 'customer.created' });
    await loadExtensibility();
  }

  if (!auth.token) return <Login onLogin={login} />;

  const totals = reports.reduce(
    (acc, report) => {
      acc.projects += report.projects;
      acc.tasks += report.tasks;
      acc.invoices += report.invoices;
      acc.revenue += Number(report.invoiceAmount || 0);
      return acc;
    },
    { projects: 0, tasks: 0, invoices: 0, revenue: 0 },
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Z</span>
          <div>
            <strong>ZioZen CRM</strong>
            <small>Enterprise Workspace</small>
          </div>
        </div>
        <nav className="nav">
          {[
            ['overview', 'Overview'],
            ['workspace', 'Workspace & Delivery'],
            ['sales', 'Sales & Pipeline'],
            ['finance', 'Contracts & Billing'],
            ['support', 'Support & Helpdesk'],
            ['admin', 'Administration'],
            ['system', 'System Health'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={view === id ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(id as View)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-badge">
            <span className="user-email">{auth.email}</span>
            <span className="user-role">Authorized Staff</span>
          </div>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="topbar-info">
            <p className="eyebrow">Enterprise Platform</p>
            <h1>
              {view === 'overview'
                ? 'Executive Dashboard'
                : view === 'workspace'
                ? 'Delivery & Operations'
                : view === 'sales'
                ? 'Sales Pipeline & Quotes'
                : view === 'finance'
                ? 'Contracts & Recurring Billing'
                : view === 'support'
                ? 'Helpdesk & Knowledge Base'
                : view === 'admin'
                ? 'Organization & User Governance'
                : 'System Architecture & Health'}
            </h1>
          </div>
          <div className="topbar-stats">
            <span className="stat-pill">{departments.length} departments</span>
            <span className="stat-pill">{customers.length} accounts</span>
            <span className="stat-pill">{projects.length} projects</span>
            <span className="stat-pill">{invoices.length} invoices</span>
          </div>
        </header>

        {error ? <div className="banner error">{error}</div> : null}

        {view === 'overview' && (
          <>
            <section className="stat-grid">
              <StatCard label="Projects" value={totals.projects} />
              <StatCard label="Tasks" value={totals.tasks} />
              <StatCard label="Invoices" value={totals.invoices} />
              <StatCard label="Revenue" value={totals.revenue.toFixed(2)} />
            </section>
            <section className="panel">
              <div className="panel-header">
                <h2>Department performance</h2>
                <p>Live, scoped operating metrics</p>
              </div>
              <DataTable
                columns={['Department', 'Customers', 'Projects', 'Tasks', 'Invoices', 'Revenue']}
                rows={reports.map((r) => [
                  r.department.name,
                  r.customers,
                  r.projects,
                  r.tasks,
                  r.invoices,
                  r.invoiceAmount,
                ])}
              />
            </section>
            <section className="panel">
              <div className="panel-header">
                <h2>Recent audit activity</h2>
                <p>Recent changes across your visible scope</p>
              </div>
              <DataTable
                columns={['When', 'Action', 'Entity', 'Actor']}
                rows={auditEntries.map((e) => [
                  new Date(e.createdAt).toLocaleString(),
                  e.action,
                  e.entityType,
                  e.actor?.email ?? 'system',
                ])}
              />
            </section>
          </>
        )}

        {view === 'workspace' && (
          <>
            <section className="workspace-grid">
              <div className="panel">
                <div className="panel-header"><h2>Customers</h2><p>Accounts and client organizations</p></div>
                <form onSubmit={createCustomer} className="form-row">
                  <input value={newCustomer.name} onChange={(e) => setNewCustomer((s) => ({ ...s, name: e.target.value }))} placeholder="Customer/Company name" required />
                  <input value={newCustomer.email} onChange={(e) => setNewCustomer((s) => ({ ...s, email: e.target.value }))} placeholder="Email" />
                  <input value={newCustomer.company} onChange={(e) => setNewCustomer((s) => ({ ...s, company: e.target.value }))} placeholder="Company" />
                  <select value={newCustomer.departmentId} onChange={(e) => setNewCustomer((s) => ({ ...s, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button>Create</button>
                </form>
                <DataTable
                  columns={['Name', 'Email', 'Company', 'Department']}
                  rows={customers.map((c) => [c.name, c.email ?? '-', c.company ?? '-', c.department?.name ?? c.departmentId])}
                />
              </div>

              <div className="panel">
                <div className="panel-header"><h2>Projects</h2><p>Create and review active work</p></div>
                <form onSubmit={createProject} className="form-row">
                  <input value={newProject.name} onChange={(e) => setNewProject((s) => ({ ...s, name: e.target.value }))} placeholder="New project name" required />
                  <select value={newProject.departmentId} onChange={(e) => setNewProject((s) => ({ ...s, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select value={newProject.customerId} onChange={(e) => setNewProject((s) => ({ ...s, customerId: e.target.value }))}>
                    <option value="">No customer</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button>Create</button>
                </form>
                <DataTable
                  columns={['Name', 'Status', 'Department']}
                  rows={projects.map((p) => [p.name, p.status, p.department?.name ?? p.departmentId])}
                />
              </div>

              <div className="panel">
                <div className="panel-header"><h2>Tasks</h2><p>Track assignments and progress</p></div>
                <form onSubmit={createTask} className="form-row">
                  <input value={newTask.title} onChange={(e) => setNewTask((s) => ({ ...s, title: e.target.value }))} placeholder="New task title" required />
                  <select value={newTask.departmentId} onChange={(e) => setNewTask((s) => ({ ...s, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select value={newTask.projectId} onChange={(e) => setNewTask((s) => ({ ...s, projectId: e.target.value }))}>
                    <option value="">No project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={newTask.customerId} onChange={(e) => setNewTask((s) => ({ ...s, customerId: e.target.value }))}>
                    <option value="">No customer</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button>Create</button>
                </form>
                <DataTable
                  columns={['Title', 'Status', 'Department', 'Project']}
                  rows={tasks.map((t) => [t.title, t.status, t.department?.name ?? t.departmentId, t.project?.name ?? '-'])}
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel-header"><h2>Invoices</h2><p>Department-scoped billing</p></div>
              <form onSubmit={createInvoice} className="form-row">
                <input value={newInvoice.number} onChange={(e) => setNewInvoice((s) => ({ ...s, number: e.target.value }))} placeholder="Invoice number" required />
                <input value={newInvoice.amount} onChange={(e) => setNewInvoice((s) => ({ ...s, amount: e.target.value }))} placeholder="Amount" required />
                <select value={newInvoice.departmentId} onChange={(e) => setNewInvoice((s) => ({ ...s, departmentId: e.target.value }))} required>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button>Create</button>
              </form>
              <DataTable
                columns={['Number', 'Amount', 'Status', 'Department', 'Actions']}
                rows={invoices.map((i) => [
                  i.number,
                  `$${i.amount}`,
                  i.status,
                  i.department?.name ?? i.departmentId,
                  i.status !== 'paid' ? (
                    <button className="primary-sm" onClick={() => recordPayment(i.id, i.amount)}>Record Payment</button>
                  ) : (
                    <span className="badge">Settled</span>
                  ),
                ])}
              />
            </section>
          </>
        )}

        {view === 'sales' && (
          <>
            <section className="workspace-grid">
              <div className="panel">
                <div className="panel-header"><h2>Leads & Prospects</h2><p>Capture and convert incoming opportunities</p></div>
                <form onSubmit={createLead} className="form-row">
                  <input value={newLead.title} onChange={(e) => setNewLead((s) => ({ ...s, title: e.target.value }))} placeholder="Lead title/Company" required />
                  <input value={newLead.value} onChange={(e) => setNewLead((s) => ({ ...s, value: e.target.value }))} placeholder="Est. Value ($)" />
                  <input value={newLead.email} onChange={(e) => setNewLead((s) => ({ ...s, email: e.target.value }))} placeholder="Email" />
                  <select value={newLead.departmentId} onChange={(e) => setNewLead((s) => ({ ...s, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button>Capture</button>
                </form>
                <DataTable
                  columns={['Title', 'Value', 'Status', 'Department', 'Actions']}
                  rows={leads.map((l) => [
                    l.title,
                    l.value ? `$${l.value}` : '-',
                    l.status,
                    l.department?.name ?? l.departmentId ?? '-',
                    l.status !== 'converted' ? (
                      <button className="primary-sm" onClick={() => convertLead(l.id, l.title)}>Convert to Client</button>
                    ) : (
                      <span className="badge">Converted</span>
                    ),
                  ])}
                />
              </div>

              <div className="panel">
                <div className="panel-header"><h2>Estimates & Quotes</h2><p>Generate quotes and convert to invoice</p></div>
                <form onSubmit={createEstimate} className="form-row">
                  <input value={newEstimate.number} onChange={(e) => setNewEstimate((s) => ({ ...s, number: e.target.value }))} placeholder="Estimate # (e.g. EST-101)" required />
                  <input value={newEstimate.total} onChange={(e) => setNewEstimate((s) => ({ ...s, total: e.target.value }))} placeholder="Total amount" required />
                  <select value={newEstimate.departmentId} onChange={(e) => setNewEstimate((s) => ({ ...s, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select value={newEstimate.customerId} onChange={(e) => setNewEstimate((s) => ({ ...s, customerId: e.target.value }))}>
                    <option value="">No client</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button>Create</button>
                </form>
                <DataTable
                  columns={['Number', 'Total', 'Status', 'Department', 'Actions']}
                  rows={estimates.map((est) => [
                    est.number,
                    `$${est.total}`,
                    est.status,
                    est.department?.name ?? est.departmentId,
                    est.status !== 'converted' ? (
                      <button className="primary-sm" onClick={() => convertEstimate(est.id)}>Convert to Invoice</button>
                    ) : (
                      <span className="badge">Invoiced</span>
                    ),
                  ])}
                />
              </div>
            </section>
          </>
        )}

        {view === 'finance' && (
          <>
            <section className="workspace-grid">
              <div className="panel">
                <div className="panel-header"><h2>Contracts & Agreements</h2><p>Legal terms, SLAs, values, and status</p></div>
                <form onSubmit={createContract} className="form-row">
                  <input value={newContract.subject} onChange={(e) => setNewContract((s) => ({ ...s, subject: e.target.value }))} placeholder="Contract subject (e.g. Master MSA)" required />
                  <input value={newContract.value} onChange={(e) => setNewContract((s) => ({ ...s, value: e.target.value }))} placeholder="Total Value ($)" />
                  <select value={newContract.departmentId} onChange={(e) => setNewContract((s) => ({ ...s, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select value={newContract.customerId} onChange={(e) => setNewContract((s) => ({ ...s, customerId: e.target.value }))}>
                    <option value="">No client</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button>Create</button>
                </form>
                <DataTable
                  columns={['Subject', 'Value', 'Status', 'Department', 'Actions']}
                  rows={contracts.map((c) => [
                    c.subject,
                    c.value ? `$${c.value}` : '-',
                    c.status,
                    c.department?.name ?? c.departmentId,
                    c.status !== 'active' ? (
                      <button className="primary-sm" onClick={() => activateContract(c.id)}>Activate</button>
                    ) : (
                      <span className="badge badge-success">Active</span>
                    ),
                  ])}
                />
              </div>

              <div className="panel">
                <div className="panel-header"><h2>Subscriptions & Retainers</h2><p>Recurring billing schedules and client tiers</p></div>
                <form onSubmit={createSubscription} className="form-row">
                  <input value={newSubscription.name} onChange={(e) => setNewSubscription((s) => ({ ...s, name: e.target.value }))} placeholder="Plan/Retainer name" required />
                  <input value={newSubscription.amount} onChange={(e) => setNewSubscription((s) => ({ ...s, amount: e.target.value }))} placeholder="Amount ($)" required />
                  <select value={newSubscription.interval} onChange={(e) => setNewSubscription((s) => ({ ...s, interval: e.target.value }))}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                  <select value={newSubscription.departmentId} onChange={(e) => setNewSubscription((s) => ({ ...s, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select value={newSubscription.customerId} onChange={(e) => setNewSubscription((s) => ({ ...s, customerId: e.target.value }))}>
                    <option value="">No client</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button>Subscribe</button>
                </form>
                <DataTable
                  columns={['Name', 'Amount', 'Interval', 'Next Bill', 'Status', 'Actions']}
                  rows={subscriptions.map((s) => [
                    s.name,
                    `$${s.amount}`,
                    s.interval,
                    new Date(s.nextBillingDate).toLocaleDateString(),
                    s.status,
                    s.status === 'active' ? (
                      <button className="secondary-sm" onClick={() => cancelSubscription(s.id)}>Cancel</button>
                    ) : (
                      <span className="badge badge-danger">Cancelled</span>
                    ),
                  ])}
                />
              </div>
            </section>
          </>
        )}

        {view === 'support' && (
          <>
            <section className="workspace-grid">
              <div className="panel">
                <div className="panel-header"><h2>Support Tickets</h2><p>Department-routed customer tickets & inquiries</p></div>
                <form onSubmit={createTicket} className="form-row">
                  <input value={newTicket.subject} onChange={(e) => setNewTicket((s) => ({ ...s, subject: e.target.value }))} placeholder="Ticket subject" required />
                  <input value={newTicket.message} onChange={(e) => setNewTicket((s) => ({ ...s, message: e.target.value }))} placeholder="Description" />
                  <select value={newTicket.priority} onChange={(e) => setNewTicket((s) => ({ ...s, priority: e.target.value }))}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <select value={newTicket.departmentId} onChange={(e) => setNewTicket((s) => ({ ...s, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button>Open Ticket</button>
                </form>
                <DataTable
                  columns={['Subject', 'Priority', 'Status', 'Department', 'Actions']}
                  rows={tickets.map((t) => [
                    t.subject,
                    t.priority,
                    t.status,
                    t.department?.name ?? t.departmentId,
                    <div className="btn-group" key={t.id}>
                      <button className="primary-sm" onClick={() => replyToTicket(t.id, false)}>Reply</button>
                      <button className="secondary-sm" onClick={() => replyToTicket(t.id, true)}>Note</button>
                    </div>,
                  ])}
                />
              </div>

              <div className="panel">
                <div className="panel-header"><h2>Knowledge Base</h2><p>Published documentation and internal runbooks</p></div>
                <DataTable
                  columns={['Title', 'Category', 'Published', 'Created']}
                  rows={articles.map((a) => [
                    a.title,
                    a.category ?? 'General',
                    a.published ? 'Yes' : 'Draft',
                    new Date(a.createdAt).toLocaleDateString(),
                  ])}
                />
              </div>
            </section>
          </>
        )}

        {view === 'admin' && (
          <>
            <section className="panel">
              <div className="panel-header"><h2>User administration</h2><p>Roles and department memberships</p></div>
              <DataTable
                columns={['Email', 'Name', 'Role', 'Departments']}
                rows={users.map((u) => [
                  u.email,
                  `${u.firstName} ${u.lastName}`,
                  <select value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value as UserRecord['role'])}>
                    {['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'].map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>,
                  u.memberships.map((m) => m.department.name).join(', ') || 'none',
                ])}
              />
              {users.length === 0 ? <p className="muted">Only administrators can manage users.</p> : null}
            </section>

            <section className="panel">
              <div className="panel-header"><h2>Departments</h2><p>Visible organizational units</p></div>
              <DataTable
                columns={['Name', 'Slug', 'Description']}
                rows={departments.map((d) => [d.name, d.slug, d.description ?? '-'])}
              />
            </section>

            <section className="workspace-grid">
              <div className="panel">
                <div className="panel-header"><h2>Custom Fields</h2><p>Schema extensibility & metadata</p></div>
                <form onSubmit={createCustomField} className="form-row">
                  <input value={newCustomField.name} onChange={(e) => setNewCustomField((s) => ({ ...s, name: e.target.value }))} placeholder="Key (e.g. vat_number)" required />
                  <input value={newCustomField.label} onChange={(e) => setNewCustomField((s) => ({ ...s, label: e.target.value }))} placeholder="Label" required />
                  <select value={newCustomField.entityType} onChange={(e) => setNewCustomField((s) => ({ ...s, entityType: e.target.value }))}>
                    <option value="Customer">Customer</option>
                    <option value="Project">Project</option>
                    <option value="Task">Task</option>
                    <option value="Lead">Lead</option>
                    <option value="Invoice">Invoice</option>
                  </select>
                  <select value={newCustomField.fieldType} onChange={(e) => setNewCustomField((s) => ({ ...s, fieldType: e.target.value }))}>
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="BOOLEAN">Boolean</option>
                    <option value="DATE">Date</option>
                  </select>
                  <button>Add Field</button>
                </form>
                <DataTable
                  columns={['Label', 'Key', 'Target Entity', 'Type']}
                  rows={customFields.map((cf) => [cf.label, cf.name, cf.entityType, cf.fieldType])}
                />
              </div>

              <div className="panel">
                <div className="panel-header"><h2>Webhooks & Events</h2><p>Real-time external HTTP integrations</p></div>
                <form onSubmit={createWebhook} className="form-row">
                  <input value={newWebhook.name} onChange={(e) => setNewWebhook((s) => ({ ...s, name: e.target.value }))} placeholder="Webhook name" required />
                  <input value={newWebhook.url} onChange={(e) => setNewWebhook((s) => ({ ...s, url: e.target.value }))} placeholder="https://endpoint.local/hook" required />
                  <select value={newWebhook.event} onChange={(e) => setNewWebhook((s) => ({ ...s, event: e.target.value }))}>
                    <option value="customer.created">customer.created</option>
                    <option value="invoice.paid">invoice.paid</option>
                    <option value="ticket.created">ticket.created</option>
                    <option value="lead.converted">lead.converted</option>
                  </select>
                  <button>Register</button>
                </form>
                <DataTable
                  columns={['Name', 'Endpoint', 'Events', 'Status']}
                  rows={webhooks.map((wh) => [
                    wh.name,
                    wh.url,
                    wh.events.join(', '),
                    wh.active ? <span className="badge">Active</span> : <span className="badge badge-danger">Disabled</span>,
                  ])}
                />
              </div>
            </section>
          </>
        )}

        {view === 'system' && (
          <section className="panel">
            <div className="panel-header"><h2>System</h2><p>Architecture and deployment status</p></div>
            <div className="system-grid">
              <div><strong>API</strong><span>http://localhost:3000</span></div>
              <div><strong>Web</strong><span>http://localhost:5173</span></div>
              <div><strong>Database</strong><span>PostgreSQL</span></div>
              <div><strong>Auth</strong><span>JWT + department scope</span></div>
              <div><strong>Audit</strong><span>Enabled</span></div>
              <div><strong>Storage</strong><span>Signed local files</span></div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: (string | number | React.ReactNode)[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : (
            <tr><td colSpan={columns.length} className="empty">No data in current scope</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      setError(null);
      await onLogin(email, password);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="login-shell">
      <form onSubmit={submit} className="login-card">
        <span className="brand-mark">Z</span>
        <h1>ZioZen CRM</h1>
        <p>Sign in to your department-scoped enterprise workspace.</p>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="primary">Sign in</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
  );
}
