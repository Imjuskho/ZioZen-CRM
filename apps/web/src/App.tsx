import { useEffect, useState } from 'react';
import './App.css';
import { api, getToken, setToken } from './api';
import type {
  AuditEntry,
  Department,
  Invoice,
  Project,
  ReportSummary,
  Task,
  UserRecord,
} from './types';

type AuthState = { token: string | null; email: string | null };
type View = 'overview' | 'workspace' | 'admin' | 'system';

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ token: getToken(), email: localStorage.getItem('ziozen_email') });
  const [view, setView] = useState<View>('overview');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ name: '', departmentId: '' });
  const [newTask, setNewTask] = useState({ title: '', departmentId: '', projectId: '' });
  const [newInvoice, setNewInvoice] = useState({ number: '', amount: '', departmentId: '' });

  async function load() {
    try {
      setError(null);
      const [d, p, t, i] = await Promise.all([
        api<Department[]>('/departments'),
        api<Project[]>('/projects'),
        api<Task[]>('/tasks'),
        api<Invoice[]>('/invoices'),
      ]);
      setDepartments(d);
      setProjects(p);
      setTasks(t);
      setInvoices(i);
      if (d[0] && !newProject.departmentId) setNewProject((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newTask.departmentId) setNewTask((s) => ({ ...s, departmentId: d[0].id }));
      if (d[0] && !newInvoice.departmentId) setNewInvoice((s) => ({ ...s, departmentId: d[0].id }));
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

  useEffect(() => {
    if (auth.token) {
      void load();
      void loadUsers();
      void loadAnalytics();
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
    setProjects([]);
    setTasks([]);
    setInvoices([]);
    setUsers([]);
    setReports([]);
    setAuditEntries([]);
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    await api('/projects', { method: 'POST', json: newProject });
    setNewProject((s) => ({ ...s, name: '' }));
    await load();
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    await api('/tasks', {
      method: 'POST',
      json: { title: newTask.title, departmentId: newTask.departmentId, projectId: newTask.projectId || undefined },
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

  async function updateUserRole(userId: string, role: UserRecord['role']) {
    await api(`/users/${userId}`, { method: 'PATCH', json: { role } });
    await loadUsers();
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
            <small>Department-aware workspace</small>
          </div>
        </div>
        <nav className="nav">
          {[
            ['overview', 'Overview'],
            ['workspace', 'Workspace'],
            ['admin', 'Administration'],
            ['system', 'System'],
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
          <span>{auth.email}</span>
          <button className="logout" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Enterprise CRM</p>
            <h1>{view === 'overview' ? 'Dashboard' : view === 'workspace' ? 'Workspace' : view === 'admin' ? 'Administration' : 'System'}</h1>
          </div>
          <div className="topbar-stats">
            <span>{departments.length} departments</span>
            <span>{projects.length} projects</span>
            <span>{invoices.length} invoices</span>
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
                <div className="panel-header"><h2>Projects</h2><p>Create and review active work</p></div>
                <form onSubmit={createProject} className="form-row">
                  <input value={newProject.name} onChange={(e) => setNewProject((s) => ({ ...s, name: e.target.value }))} placeholder="New project name" required />
                  <select value={newProject.departmentId} onChange={(e) => setNewProject((s) => ({ ...s, departmentId: e.target.value }))} required>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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
                columns={['Number', 'Amount', 'Status', 'Department']}
                rows={invoices.map((i) => [i.number, i.amount, i.status, i.department?.name ?? i.departmentId])}
              />
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
