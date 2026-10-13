import { useEffect, useState } from 'react';
import './App.css';
import { api, getToken, setToken } from './api';
import type { Department, Project, Task, Invoice } from './types';

type AuthState = { token: string | null; email: string | null };

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ token: getToken(), email: localStorage.getItem('ziozen_email') });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

  useEffect(() => {
    if (auth.token) void load();
  }, [auth.token]);

  async function login(email: string, password: string) {
    const response = await api<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      json: { email, password },
    });
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
      json: {
        title: newTask.title,
        departmentId: newTask.departmentId,
        projectId: newTask.projectId || undefined,
      },
    });
    setNewTask((s) => ({ ...s, title: '' }));
    await load();
  }

  async function createInvoice(event: React.FormEvent) {
    event.preventDefault();
    await api('/invoices', {
      method: 'POST',
      json: {
        number: newInvoice.number,
        amount: newInvoice.amount,
        departmentId: newInvoice.departmentId,
      },
    });
    setNewInvoice((s) => ({ ...s, number: '', amount: '' }));
    await load();
  }

  if (!auth.token) {
    return <Login onLogin={login} />;
  }

  return (
    <div className="shell">
      <header>
        <h1>ZioZen CRM</h1>
        <div>
          <span>{auth.email}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <main>
        <section className="panel">
          <h2>Department scope</h2>
          <p>
            The API filters projects, tasks, and invoices by department membership. Admins see
            every department; everyone else sees only assigned departments.
          </p>
          <ul>
            {departments.map((department) => (
              <li key={department.id}>{department.name}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Projects ({projects.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.status}</td>
                  <td>{project.department?.name ?? project.departmentId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={createProject} className="row">
            <input
              value={newProject.name}
              onChange={(e) => setNewProject((s) => ({ ...s, name: e.target.value }))}
              placeholder="New project name"
              required
            />
            <select
              value={newProject.departmentId}
              onChange={(e) => setNewProject((s) => ({ ...s, departmentId: e.target.value }))}
              required
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <button>Create project</button>
          </form>
        </section>

        <section className="panel">
          <h2>Tasks ({tasks.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Department</th>
                <th>Project</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.status}</td>
                  <td>{task.department?.name ?? task.departmentId}</td>
                  <td>{task.project?.name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={createTask} className="row">
            <input
              value={newTask.title}
              onChange={(e) => setNewTask((s) => ({ ...s, title: e.target.value }))}
              placeholder="New task title"
              required
            />
            <select
              value={newTask.departmentId}
              onChange={(e) => setNewTask((s) => ({ ...s, departmentId: e.target.value }))}
              required
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              value={newTask.projectId}
              onChange={(e) => setNewTask((s) => ({ ...s, projectId: e.target.value }))}
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <button>Create task</button>
          </form>
        </section>

        <section className="panel">
          <h2>Invoices ({invoices.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Department</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.number}</td>
                  <td>{invoice.amount}</td>
                  <td>{invoice.status}</td>
                  <td>{invoice.department?.name ?? invoice.departmentId}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={createInvoice} className="row">
            <input
              value={newInvoice.number}
              onChange={(e) => setNewInvoice((s) => ({ ...s, number: e.target.value }))}
              placeholder="Invoice number"
              required
            />
            <input
              value={newInvoice.amount}
              onChange={(e) => setNewInvoice((s) => ({ ...s, amount: e.target.value }))}
              placeholder="Amount"
              required
            />
            <select
              value={newInvoice.departmentId}
              onChange={(e) => setNewInvoice((s) => ({ ...s, departmentId: e.target.value }))}
              required
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <button>Create invoice</button>
          </form>
        </section>

        {error ? <p className="error">{error}</p> : null}
      </main>
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
    <div className="login">
      <form onSubmit={submit} className="panel">
        <h1>ZioZen CRM</h1>
        <p>Sign in to your department-scoped workspace.</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          required
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          required
        />
        <button>Sign in</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
  );
}
