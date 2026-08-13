import {
  emptyValidation,
  type Generator,
  type GenerationContextLike,
  type StarterConfig,
  type ValidationResult,
} from '../../core/types.js';
import { ctxPaths, isTs, t } from '../helpers.js';

export class AdminGenerator implements Generator {
  id(): string {
    return 'frontend-admin';
  }

  supports(config: StarterConfig): boolean {
    return config.admin !== 'none';
  }

  validate(): ValidationResult {
    return emptyValidation();
  }

  async generate(ctx: GenerationContextLike): Promise<void> {
    const { config } = ctx;
    if (config.admin === 'custom') {
      if (config.frontend.kind !== 'none') {
        writeCustomInsideWeb(ctx);
      } else {
        writeStandaloneAdmin(ctx, 'custom');
      }
      return;
    }
    if (config.admin === 'refine') {
      writeStandaloneAdmin(ctx, 'refine');
      return;
    }
    writeStandaloneAdmin(ctx, 'react-admin');
  }
}

function adminWrite(ctx: GenerationContextLike, rel: string, contents: string): void {
  ctx.writeFile(`${ctxPaths(ctx).adminRoot}/${rel}`, contents.endsWith('\n') ? contents : `${contents}\n`);
}

function writeCustomInsideWeb(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const rx = ctxPaths(ctx).reactExt;
  const web = ctxPaths(ctx).webRoot;
  const write = (rel: string, contents: string) =>
    ctx.writeFile(`${web}/${rel}`, contents.endsWith('\n') ? contents : `${contents}\n`);

  write(`src/pages/admin/Dashboard.${rx}`, customDashboard(config, true));
  write(`src/pages/admin/Users.${rx}`, customUsers(config, true));
  write(`src/pages/admin/Roles.${rx}`, customRoles(config, true));
  write(`src/routes/admin.${rx}`, webAdminRoutes(config));
  if (config.frontend.kind === 'nextjs') {
    write(`src/app/admin/page.${rx}`, `'use client';\nimport AdminDashboard from '@/pages/admin/Dashboard';\nexport default function Page() { return <AdminDashboard />; }\n`);
    write(`src/app/admin/users/page.${rx}`, `'use client';\nimport AdminUsers from '@/pages/admin/Users';\nexport default function Page() { return <AdminUsers />; }\n`);
    write(`src/app/admin/roles/page.${rx}`, `'use client';\nimport AdminRoles from '@/pages/admin/Roles';\nexport default function Page() { return <AdminRoles />; }\n`);
  }
}

function writeStandaloneAdmin(ctx: GenerationContextLike, kind: 'custom' | 'refine' | 'react-admin'): void {
  const { config } = ctx;
  const rx = isTs(config) ? 'tsx' : 'jsx';
  const ext = isTs(config) ? 'ts' : 'js';

  const deps: Array<[string, string, boolean?]> = [
    ['react', '^18.3.1'],
    ['react-dom', '^18.3.1'],
    ['react-router-dom', '^7.4.0'],
    ['axios', '^1.8.4'],
  ];
  const dev: Array<[string, string, boolean?]> = [
    ['vite', '^6.2.3', true],
    ['@vitejs/plugin-react', '^4.3.4', true],
  ];
  if (isTs(config)) {
    dev.push(
      ['typescript', '^5.8.2', true],
      ['@types/react', '^18.3.20', true],
      ['@types/react-dom', '^18.3.5', true],
      ['@types/node', '^22.13.14', true],
    );
  }
  if (kind === 'refine') {
    deps.push(
      ['@refinedev/core', '^4.57.9'],
      ['@refinedev/react-router-v6', '^4.6.2'],
      ['@refinedev/simple-rest', '^5.0.10'],
      ['@refinedev/antd', '^5.44.0'],
      ['antd', '^5.24.5'],
    );
  }
  if (kind === 'react-admin') {
    deps.push(['react-admin', '^5.6.3'], ['ra-data-simple-rest', '^5.6.3']);
  }

  const collected = { dependencies: {} as Record<string, string>, devDependencies: {} as Record<string, string> };
  for (const [name, version, isDev] of [...deps, ...dev]) {
    ctx.addPackage({ name, version, dev: Boolean(isDev), workspace: 'admin' });
    if (isDev) collected.devDependencies[name] = version;
    else collected.dependencies[name] = version;
  }

  adminWrite(
    ctx,
    'package.json',
    JSON.stringify(
      {
        name: 'admin',
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'vite --port 5174',
          build: 'vite build',
          preview: 'vite preview',
          typecheck: isTs(config) ? 'tsc --noEmit' : 'echo skip',
        },
        dependencies: collected.dependencies,
        devDependencies: collected.devDependencies,
      },
      null,
      2,
    ),
  );

  adminWrite(
    ctx,
    isTs(config) ? 'vite.config.ts' : 'vite.config.js',
    `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(dir, 'src') } },
  server: {
    port: 5174,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
});
`,
  );

  if (isTs(config)) {
    adminWrite(
      ctx,
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            strict: true,
            noEmit: true,
            isolatedModules: true,
            paths: { '@/*': ['./src/*'] },
          },
          include: ['src'],
        },
        null,
        2,
      ),
    );
  }

  adminWrite(
    ctx,
    'index.html',
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.name} admin</title>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${rx}"></script>
  </body>
</html>
`,
  );

  adminWrite(
    ctx,
    `src/index.css`,
    `:root { --paper: #f7f5f2; --ink: #1c1917; --copper: #b45309; --rule: #d6d3d1; --muted: #78716c; --surface: #fffcf8; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: 'IBM Plex Sans', system-ui, sans-serif; font-variant-numeric: tabular-nums; }
`,
  );

  adminWrite(
    ctx,
    `src/main.${rx}`,
    `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')${t(config, '!')}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  );

  if (kind === 'refine') {
    adminWrite(ctx, `src/App.${rx}`, refineApp(config));
    adminWrite(ctx, `src/pages/Users.${rx}`, refineList('users', 'Users'));
    adminWrite(ctx, `src/pages/Roles.${rx}`, refineList('roles', 'Roles'));
    adminWrite(ctx, `src/pages/Dashboard.${rx}`, refineDashboard());
    return;
  }

  if (kind === 'react-admin') {
    adminWrite(ctx, `src/App.${rx}`, reactAdminApp(config));
    return;
  }

  adminWrite(ctx, `src/App.${rx}`, customStandaloneApp(config));
  adminWrite(ctx, `src/pages/Dashboard.${rx}`, customDashboard(config, false));
  adminWrite(ctx, `src/pages/Users.${rx}`, customUsers(config, false));
  adminWrite(ctx, `src/pages/Roles.${rx}`, customRoles(config, false));
  adminWrite(ctx, `src/services/api.${ext}`, standaloneApi(config));
}

function webAdminRoutes(config: StarterConfig): string {
  const guard = config.rbac !== 'none' ? `<RoleRoute roles={['admin']} />` : `<ProtectedRoute />`;
  const guardImport = config.rbac !== 'none' ? 'RoleRoute' : 'ProtectedRoute';
  return `import { Route } from 'react-router-dom';
import { ${guardImport} } from './protected';
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminUsers from '@/pages/admin/Users';
import AdminRoles from '@/pages/admin/Roles';

export const adminRouteElements = (
  <Route element={${guard}}>
    <Route path="/admin" element={<AdminDashboard />} />
    <Route path="/admin/users" element={<AdminUsers />} />
    <Route path="/admin/roles" element={<AdminRoles />} />
  </Route>
);
`;
}

function customDashboard(config: StarterConfig, nested: boolean): string {
  const nav = nested
    ? config.frontend.kind === 'nextjs'
      ? `<p><a href="/admin/users">Users</a> · <a href="/admin/roles">Roles</a></p>`
      : `<p><a href="/admin/users">Users</a> · <a href="/admin/roles">Roles</a></p>`
    : `<p><a href="/users">Users</a> · <a href="/roles">Roles</a></p>`;
  return `export default function AdminDashboard() {
  return (
    <section style={{ padding: 24 }}>
      <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)' }}>ADMIN · DASH-00</p>
      <h1>Control sheet</h1>
      <p>Users, roles, and filters. Authorization is enforced on the API (${config.rbac}).</p>
      ${nav}
    </section>
  );
}
`;
}

function customUsers(config: StarterConfig, _nested: boolean): string {
  return `import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/services/api';

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [rows, setRows] = useState${isTs(config) ? '<Array<{ id: string; email: string; roles?: string[] }>>' : ''}([]);

  useEffect(() => {
    apiGet('/users')
      .then((data) => setRows(data.items ?? data.users ?? data ?? []))
      .catch(() => setRows([]));
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const matchesQ = row.email.toLowerCase().includes(q.toLowerCase());
        const matchesRole = role === 'all' || row.roles?.includes(role);
        return matchesQ && matchesRole;
      }),
    [rows, q, role],
  );

  return (
    <section style={{ padding: 24 }}>
      <h1>Users</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input aria-label="Filter users" placeholder="Filter email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Role filter" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">All roles</option>
          <option value="admin">admin</option>
          <option value="user">user</option>
        </select>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--rule)', padding: 8 }}>Email</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--rule)', padding: 8 }}>Roles</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id}>
              <td style={{ borderBottom: '1px solid var(--rule)', padding: 8 }}>{row.email}</td>
              <td style={{ borderBottom: '1px solid var(--rule)', padding: 8 }}>{(row.roles ?? []).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
`;
}

function customRoles(_config: StarterConfig, _nested: boolean): string {
  return `import { useEffect, useState } from 'react';
import { apiGet } from '@/services/api';

export default function AdminRoles() {
  const [rows, setRows] = useState${isTs(_config) ? '<Array<{ id: string; name: string }>>' : ''}([]);
  useEffect(() => {
    apiGet('/roles')
      .then((data) => setRows(data.items ?? data ?? []))
      .catch(() => setRows([{ id: 'admin', name: 'admin' }, { id: 'user', name: 'user' }]));
  }, []);
  return (
    <section style={{ padding: 24 }}>
      <h1>Roles</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid var(--rule)', padding: 8 }}>Name</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ borderBottom: '1px solid var(--rule)', padding: 8 }}>{row.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
`;
}

function customStandaloneApp(config: StarterConfig): string {
  return `import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import AdminDashboard from './pages/Dashboard';
import AdminUsers from './pages/Users';
import AdminRoles from './pages/Roles';

export function App() {
  return (
    <BrowserRouter>
      <header style={{ display: 'flex', gap: 16, padding: 16, borderBottom: '1px solid var(--rule)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
        <strong>${config.name}</strong>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/users">Users</NavLink>
        <NavLink to="/roles">Roles</NavLink>
      </header>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/roles" element={<AdminRoles />} />
      </Routes>
    </BrowserRouter>
  );
}
`;
}

function standaloneApi(config: StarterConfig): string {
  return `import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  withCredentials: true,
});

export async function apiGet(path${t(config, ': string')}) {
  const res = await api.get(path);
  return res.data;
}
`;
}

function refineApp(config: StarterConfig): string {
  return `import { Refine } from '@refinedev/core';
import routerProvider from '@refinedev/react-router-v6';
import dataProvider from '@refinedev/simple-rest';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { AntdLayout, ErrorComponent, useNotificationProvider } from '@refinedev/antd';
import '@refinedev/antd/dist/reset.css';
import AdminDashboard from './pages/Dashboard';
import { UserList } from './pages/Users';
import { RoleList } from './pages/Roles';

export function App() {
  return (
    <BrowserRouter>
      <Refine
        routerProvider={routerProvider}
        dataProvider={dataProvider(import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1')}
        notificationProvider={useNotificationProvider}
        resources={[
          { name: 'users', list: '/users' },
          { name: 'roles', list: '/roles' },
        ]}
        options={{ syncWithLocation: true }}
      >
        <Routes>
          <Route
            element={
              <AntdLayout>
                <Outlet />
              </AntdLayout>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="/users" element={<UserList />} />
            <Route path="/roles" element={<RoleList />} />
          </Route>
          <Route path="*" element={<ErrorComponent />} />
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}
`;
}

function refineList(resource: string, title: string): string {
  return `import { List, useTable } from '@refinedev/antd';
import { Table, Input } from 'antd';
import { useState } from 'react';

export function ${title === 'Users' ? 'UserList' : 'RoleList'}() {
  const [q, setQ] = useState('');
  const { tableProps } = useTable({ resource: '${resource}', syncWithLocation: true });
  return (
    <List title="${title}">
      <Input.Search placeholder="Filter" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12, maxWidth: 280 }} />
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="id" title="ID" />
        <Table.Column dataIndex="${resource === 'users' ? 'email' : 'name'}" title="${resource === 'users' ? 'Email' : 'Name'}"
          filteredValue={q ? [q] : undefined}
          onFilter={(value, record) => String(record[${resource === 'users' ? "'email'" : "'name'"}] ?? '').includes(String(value))}
        />
      </Table>
    </List>
  );
}
`;
}

function refineDashboard(): string {
  return `export default function AdminDashboard() {
  return (
    <section>
      <h1>Admin dashboard</h1>
      <p>Refine resources: users and roles. Filters live on each list.</p>
    </section>
  );
}
`;
}

function reactAdminApp(config: StarterConfig): string {
  return `import { Admin, Resource, ListGuesser, EditGuesser, ShowGuesser } from 'react-admin';
import simpleRestProvider from 'ra-data-simple-rest';

const dataProvider = simpleRestProvider(import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1');

export function App() {
  return (
    <Admin dataProvider={dataProvider} title="${config.name} admin" requireAuth={false}>
      <Resource name="users" list={ListGuesser} edit={EditGuesser} show={ShowGuesser} />
      <Resource name="roles" list={ListGuesser} edit={EditGuesser} show={ShowGuesser} />
    </Admin>
  );
}
`;
}
