import {
  emptyValidation,
  type Generator,
  type GenerationContextLike,
  type StarterConfig,
  type UiFramework,
  type ValidationResult,
} from '../../core/types.js';
import { addWebDeps, ctxPaths, isTs, t } from '../helpers.js';

const V = {
  react: '^19.1.0',
  reactDom: '^19.1.0',
  vite: '^6.2.3',
  pluginReact: '^4.3.4',
  router: '^7.4.0',
  typescript: '^7.0.2',
  typesReact: '^19.1.8',
  typesReactDom: '^19.1.6',
  typesNode: '^22.13.14',
  tailwind: '^3.4.17',
  postcss: '^8.5.3',
  autoprefixer: '^10.4.21',
  clsx: '^2.1.1',
  twMerge: '^3.0.2',
  cva: '^0.7.1',
  lucide: '^0.483.0',
  mui: '^6.4.8',
  emotionReact: '^11.14.0',
  emotionStyled: '^11.14.0',
  antd: '^5.24.5',
  chakra: '^2.10.7',
  framer: '^11.18.2',
  headless: '^2.2.0',
  zustand: '^5.0.3',
  rtk: '^2.6.1',
  redux: '^9.2.0',
  jotai: '^2.12.2',
  tanstack: '^5.69.0',
  swr: '^2.3.3',
  rhf: '^7.54.2',
  formik: '^2.4.6',
  resolvers: '^4.1.3',
  zod: '^3.24.2',
  yup: '^1.6.1',
  valibot: '^1.0.0',
  joi: '^17.13.3',
  axios: '^1.8.4',
  next: '^15.2.4',
} as const;

export class WebGenerator implements Generator {
  id(): string {
    return 'frontend-web';
  }

  supports(config: StarterConfig): boolean {
    return config.frontend.kind !== 'none';
  }

  validate(): ValidationResult {
    return emptyValidation();
  }

  async generate(ctx: GenerationContextLike): Promise<void> {
    const { config } = ctx;
    registerWebPackages(ctx);
    writeWebPackageJson(ctx);
    writeSharedSources(ctx);
    if (config.frontend.kind === 'nextjs') {
      writeNextApp(ctx);
    } else {
      writeViteApp(ctx);
    }
  }
}

function webWrite(ctx: GenerationContextLike, rel: string, contents: string): void {
  ctx.writeFile(`${ctxPaths(ctx).webRoot}/${rel}`, contents.endsWith('\n') ? contents : `${contents}\n`);
}

function usesTailwind(ui: UiFramework): boolean {
  return ui === 'tailwind' || ui === 'shadcn';
}

function registerWebPackages(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const f = config.frontend;
  const deps: Array<[string, string, boolean?]> = [
    ['react', V.react],
    ['react-dom', V.reactDom],
  ];
  const dev: Array<[string, string, boolean?]> = [];

  if (f.kind === 'nextjs') {
    deps.push(['next', V.next]);
  } else {
    dev.push(['vite', V.vite, true], ['@vitejs/plugin-react', V.pluginReact, true]);
    if (f.router) deps.push(['react-router-dom', V.router]);
  }

  if (isTs(config)) {
    dev.push(
      ['typescript', V.typescript, true],
      ['@types/react', V.typesReact, true],
      ['@types/react-dom', V.typesReactDom, true],
      ['@types/node', V.typesNode, true],
    );
  }

  if (usesTailwind(f.ui)) {
    dev.push(['tailwindcss', V.tailwind, true], ['postcss', V.postcss, true], ['autoprefixer', V.autoprefixer, true]);
    deps.push(['clsx', V.clsx], ['tailwind-merge', V.twMerge]);
    if (f.ui === 'shadcn') deps.push(['class-variance-authority', V.cva], ['lucide-react', V.lucide]);
  }

  if (f.ui === 'mui') {
    deps.push(['@mui/material', V.mui], ['@emotion/react', V.emotionReact], ['@emotion/styled', V.emotionStyled]);
  }
  if (f.ui === 'antd') deps.push(['antd', V.antd]);
  if (f.ui === 'chakra') {
    deps.push(
      ['@chakra-ui/react', V.chakra],
      ['@emotion/react', V.emotionReact],
      ['@emotion/styled', V.emotionStyled],
      ['framer-motion', V.framer],
    );
  }
  if (f.ui === 'headless') deps.push(['@headlessui/react', V.headless]);

  if (f.state === 'zustand') deps.push(['zustand', V.zustand]);
  if (f.state === 'redux') deps.push(['@reduxjs/toolkit', V.rtk], ['react-redux', V.redux]);
  if (f.state === 'jotai') deps.push(['jotai', V.jotai]);
  if (f.serverState === 'tanstack-query') deps.push(['@tanstack/react-query', V.tanstack]);
  if (f.serverState === 'swr') deps.push(['swr', V.swr]);
  if (f.forms === 'react-hook-form') {
    deps.push(['react-hook-form', V.rhf], ['@hookform/resolvers', V.resolvers]);
  }
  if (f.forms === 'formik') deps.push(['formik', V.formik]);
  if (f.validation === 'zod') deps.push(['zod', V.zod]);
  if (f.validation === 'yup') deps.push(['yup', V.yup]);
  if (f.validation === 'valibot') deps.push(['valibot', V.valibot]);
  if (f.validation === 'joi') deps.push(['joi', V.joi]);
  if (f.apiClient === 'axios') deps.push(['axios', V.axios]);

  dev.push(
    ['vitest', '^3.0.9', true],
    ['@testing-library/react', '^16.2.0', true],
    ['@testing-library/jest-dom', '^6.6.3', true],
    ['@testing-library/user-event', '^14.6.1', true],
    ['jsdom', '^26.0.0', true],
  );

  addWebDeps(ctx, [...deps, ...dev]);
}

function writeWebPackageJson(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const next = config.frontend.kind === 'nextjs';
  const pkg = {
    name: 'web',
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: next
      ? {
          dev: 'next dev --port 3000',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
          typecheck: isTs(config) ? 'tsc --noEmit' : 'echo "skip"',
          test: 'vitest run',
        }
      : {
          dev: 'vite',
          build: isTs(config) ? 'tsc --noEmit && vite build' : 'vite build',
          preview: 'vite preview',
          lint: 'eslint src',
          typecheck: isTs(config) ? 'tsc --noEmit' : 'echo "skip"',
          test: 'vitest run',
        },
    dependencies: Object.fromEntries(
      ctx.packages.filter((p) => p.workspace === 'web' && !p.dev).map((p) => [p.name, p.version]),
    ),
    devDependencies: Object.fromEntries(
      ctx.packages.filter((p) => p.workspace === 'web' && p.dev).map((p) => [p.name, p.version]),
    ),
  };
  webWrite(ctx, 'package.json', JSON.stringify(pkg, null, 2));
}

function writeViteApp(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const rx = ctxPaths(ctx).reactExt;
  const main = `src/main.${rx}`;
  webWrite(ctx, 'index.html', viteIndexHtml(config, main));
  webWrite(ctx, isTs(config) ? 'vite.config.ts' : 'vite.config.js', viteConfig(config));
  if (isTs(config)) {
    webWrite(ctx, 'tsconfig.json', viteTsconfig());
    webWrite(ctx, 'tsconfig.node.json', viteTsconfigNode());
    webWrite(ctx, 'src/vite-env.d.ts', '/// <reference types="vite/client" />\n');
  } else {
    webWrite(ctx, 'jsconfig.json', `${JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      },
      include: ['src'],
    }, null, 2)}\n`);
  }
  if (usesTailwind(config.frontend.ui)) {
    webWrite(ctx, 'postcss.config.js', `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`);
    webWrite(ctx, 'tailwind.config.js', tailwindConfig());
  }
  webWrite(ctx, `src/main.${rx}`, viteMain(config));
  webWrite(ctx, `src/App.${rx}`, viteApp(config));
}

function writeNextApp(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const rx = ctxPaths(ctx).reactExt;
  webWrite(ctx, isTs(config) ? 'next.config.ts' : 'next.config.mjs', nextConfig());
  if (isTs(config)) webWrite(ctx, 'tsconfig.json', nextTsconfig());
  webWrite(ctx, `src/app/globals.css`, indexCss(config));
  webWrite(ctx, `src/app/layout.${rx}`, nextLayout(config));
  webWrite(ctx, `src/app/page.${rx}`, nextPage('HomePage'));
  if (config.auth !== 'none') {
    webWrite(ctx, `src/app/login/page.${rx}`, nextPage('LoginPage'));
    webWrite(ctx, `src/app/register/page.${rx}`, nextPage('RegisterPage'));
  }
  webWrite(ctx, `src/app/dashboard/page.${rx}`, nextPage('DashboardPage'));
  if (config.rbac !== 'none') {
    webWrite(ctx, `src/app/admin/page.${rx}`, nextPage('AdminPlaceholder'));
  }
  webWrite(ctx, isTs(config) ? 'middleware.ts' : 'middleware.js', nextMiddleware(config));
}

function writeSharedSources(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const rx = ctxPaths(ctx).reactExt;
  const ext = ctxPaths(ctx).ext;

  webWrite(ctx, config.frontend.kind === 'nextjs' ? 'src/app/globals.css' : 'src/index.css', indexCss(config));
  if (config.frontend.kind === 'nextjs') {
    // globals written again from writeNextApp; keep index.css too for tests
    webWrite(ctx, 'src/index.css', indexCss(config));
  }

  webWrite(ctx, `src/types/user.${ext}`, userTypes(config));
  webWrite(ctx, `src/types/api.${ext}`, apiTypes(config));
  webWrite(ctx, `src/utils/format.${ext}`, formatUtil(config));
  webWrite(ctx, `src/lib/cn.${ext}`, cnUtil(config));
  if (usesTailwind(config.frontend.ui) || config.frontend.ui === 'shadcn') {
    webWrite(ctx, `src/lib/utils.${ext}`, `export { cn } from './cn';\n`);
  }

  webWrite(ctx, `src/services/api.${ext}`, apiClient(config));
  webWrite(ctx, `src/services/auth.${ext}`, authService(config));
  writeStore(ctx);
  webWrite(ctx, `src/hooks/useAuth.${rx}`, useAuthHook(config));
  webWrite(ctx, `src/hooks/useDocumentTitle.${rx}`, documentTitleHook(config));
  webWrite(ctx, `src/components/PageFallback.${rx}`, pageFallback(config));
  webWrite(ctx, `src/components/TitleBlock.${rx}`, titleBlock(config));
  writeUiKit(ctx);
  webWrite(ctx, `src/layouts/RootLayout.${rx}`, rootLayout(config));
  webWrite(ctx, `src/layouts/AuthLayout.${rx}`, authLayout(config));
  webWrite(ctx, `src/layouts/AppLayout.${rx}`, appLayout(config));
  webWrite(ctx, `src/pages/Home.${rx}`, homePage(config));
  webWrite(ctx, `src/pages/Dashboard.${rx}`, dashboardPage(config));
  if (config.auth !== 'none') {
    webWrite(ctx, `src/pages/Login.${rx}`, loginPage(config));
    webWrite(ctx, `src/pages/Register.${rx}`, registerPage(config));
    webWrite(ctx, `src/features/auth/LoginForm.${rx}`, loginForm(config));
    webWrite(ctx, `src/features/auth/RegisterForm.${rx}`, registerForm(config));
  }
  webWrite(ctx, `src/features/dashboard/Overview.${rx}`, overview(config));
  if (config.frontend.kind !== 'nextjs') {
    webWrite(ctx, `src/routes/public.${rx}`, publicRoutes(config));
    webWrite(ctx, `src/routes/protected.${rx}`, protectedRoutes(config));
    webWrite(ctx, `src/routes/index.${rx}`, routeIndex(config));
  } else {
    webWrite(ctx, `src/pages/AdminPlaceholder.${rx}`, adminPlaceholder(config));
  }
  webWrite(ctx, `src/components/Providers.${rx}`, providers(config));
  webWrite(
    ctx,
    `src/test/setup.${ctxPaths(ctx).ext}`,
    `import '@testing-library/jest-dom/vitest';\n`,
  );
}

function writeStore(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const ext = ctxPaths(ctx).ext;
  const rx = ctxPaths(ctx).reactExt;
  if (config.frontend.state === 'redux') {
    webWrite(ctx, `src/stores/authSlice.${ext}`, reduxSlice(config));
    webWrite(ctx, `src/stores/index.${ext}`, reduxStore(config));
    return;
  }
  if (config.frontend.state === 'jotai') {
    webWrite(ctx, `src/stores/auth.${ext}`, jotaiStore(config));
    return;
  }
  if (config.frontend.state === 'zustand') {
    webWrite(ctx, `src/stores/auth.${ext}`, zustandStore(config));
    return;
  }
  webWrite(ctx, `src/stores/auth.${rx}`, contextStore(config));
}

function writeUiKit(ctx: GenerationContextLike): void {
  const { config } = ctx;
  const rx = ctxPaths(ctx).reactExt;
  webWrite(ctx, `src/components/ui/button.${rx}`, uiButton(config));
  webWrite(ctx, `src/components/ui/input.${rx}`, uiInput(config));
  webWrite(ctx, `src/components/ui/card.${rx}`, uiCard(config));
  webWrite(ctx, `src/components/ui/label.${rx}`, uiLabel(config));
}

function client(config: StarterConfig): string {
  return config.frontend.kind === 'nextjs' ? "'use client';\n\n" : '';
}

function envApi(config: StarterConfig): string {
  return config.frontend.kind === 'nextjs'
    ? "process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'"
    : "import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1'";
}

function envName(config: StarterConfig): string {
  return config.frontend.kind === 'nextjs'
    ? "process.env.NEXT_PUBLIC_APP_NAME ?? 'App'"
    : "import.meta.env.VITE_APP_NAME ?? 'App'";
}

function viteIndexHtml(config: StarterConfig, main: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/${main}"></script>
  </body>
</html>
`;
}

function viteConfig(config: StarterConfig): string {
  return `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.${isTs(config) ? 'ts' : 'js'}'],
  },
});
`;
}

function viteTsconfig(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        useDefineForClassFields: true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: 'force',
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        baseUrl: '.',
        paths: { '@/*': ['src/*'] },
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    },
    null,
    2,
  )}\n`;
}

function viteTsconfigNode(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2023'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: 'force',
        noEmit: true,
        strict: true,
        types: ['node'],
      },
      include: ['vite.config.ts'],
    },
    null,
    2,
  )}\n`;
}

function nextTsconfig(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./src/*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    },
    null,
    2,
  )}\n`;
}

function nextConfig(): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:4000/api/:path*' }];
  },
};
export default nextConfig;
`;
}

function tailwindConfig(): string {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F5F2',
        ink: '#1C1917',
        copper: '#B45309',
        rule: '#D6D3D1',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '2px' },
    },
  },
  plugins: [],
};
`;
}

function indexCss(config: StarterConfig): string {
  const tw = usesTailwind(config.frontend.ui)
    ? `@tailwind base;
@tailwind components;
@tailwind utilities;

`
    : '';
  return `${tw}:root {
  --paper: #f7f5f2;
  --ink: #1c1917;
  --copper: #b45309;
  --rule: #d6d3d1;
  --muted: #78716c;
  --surface: #fffcf8;
  --grid: rgba(28, 25, 23, 0.06);
}

* { box-sizing: border-box; }

html, body, #root { min-height: 100%; }

body {
  margin: 0;
  color: var(--ink);
  background-color: var(--paper);
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 24px 24px;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-feature-settings: 'tnum' 1, 'lnum' 1;
}

code, .mono, kbd {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}

a { color: var(--copper); }

.sheet {
  background: var(--surface);
  border: 1px solid var(--rule);
}

.hairline { border: 1px solid var(--rule); }

:focus-visible {
  outline: 2px solid var(--copper);
  outline-offset: 2px;
}
`;
}

function viteMain(config: StarterConfig): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')${t(config, '!')}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;
}

function viteApp(config: StarterConfig): string {
  if (!config.frontend.router) {
    return `import { Providers } from './components/Providers';
import HomePage from './pages/Home';

export function App() {
  return (
    <Providers>
      <HomePage />
    </Providers>
  );
}
`;
  }
  return `import { BrowserRouter } from 'react-router-dom';
import { Providers } from './components/Providers';
import { AppRoutes } from './routes';

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  );
}
`;
}

function nextLayout(config: StarterConfig): string {
  return `${isTs(config) ? "import type { ReactNode } from 'react';\n" : ''}import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata = { title: ${JSON.stringify(config.name)} };

export default function RootLayout({ children }${t(config, ': { children: ReactNode }')}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`;
}

function nextPage(exportName: string): string {
  return `'use client';

import ${exportName} from '@/pages/${exportName === 'HomePage' ? 'Home' : exportName === 'LoginPage' ? 'Login' : exportName === 'RegisterPage' ? 'Register' : exportName === 'DashboardPage' ? 'Dashboard' : 'AdminPlaceholder'}';

export default function Page() {
  return <${exportName} />;
}
`;
}

function nextMiddleware(config: StarterConfig): string {
  if (config.auth === 'none') {
    return `export function middleware() {}\nexport const config = { matcher: [] };\n`;
  }
  return `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request${t(config, ': NextRequest')}) {
  const hasSession = Boolean(request.cookies.get('refresh_token')?.value);
  const path = request.nextUrl.pathname;
  const isGuest = path === '/login' || path === '/register';
  const isProtected = path.startsWith('/dashboard') || path.startsWith('/admin');
  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (isGuest && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/register'] };
`;
}

function userTypes(config: StarterConfig): string {
  if (!isTs(config)) {
    return `/** @typedef {{ id: string, email: string, name?: string, roles?: string[] }} User */\nexport {};\n`;
  }
  return `export interface User {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
}

export interface AuthPayload {
  user: User;
  accessToken?: string;
}
`;
}

function apiTypes(config: StarterConfig): string {
  if (!isTs(config)) return `export {};\n`;
  return `export interface ApiError {
  error: { code: string; message: string; details?: Array<{ path: string; message: string }> };
}

export interface Paginated<T> {
  items: T[];
  page?: number;
  pageSize?: number;
  total?: number;
  nextCursor?: string | null;
}
`;
}

function formatUtil(config: StarterConfig): string {
  return `export function formatSheetDate(value${t(config, ': Date | string | number')} = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
`;
}

function cnUtil(config: StarterConfig): string {
  if (usesTailwind(config.frontend.ui)) {
    return `import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(${isTs(config) ? '...inputs: Array<string | undefined | false | null>' : '...inputs'}) {
  return twMerge(clsx(inputs));
}
`;
  }
  return `export function cn(${isTs(config) ? '...parts: Array<string | undefined | false | null>' : '...parts'}) {
  return parts.filter(Boolean).join(' ');
}
`;
}

function apiClient(config: StarterConfig): string {
  const base = envApi(config);
  if (config.frontend.apiClient === 'axios') {
    return `import axios from 'axios';

export const api = axios.create({
  baseURL: ${base},
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise${t(config, ': Promise<void> | null')} = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original.headers?.['X-Retry']) {
      original.headers = original.headers ?? {};
      original.headers['X-Retry'] = '1';
      refreshPromise ??= api.post('/auth/refresh').then(() => undefined).finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      return api(original);
    }
    return Promise.reject(error);
  },
);

export async function apiGet(path${t(config, ': string')}) {
  const res = await api.get(path);
  return res.data;
}

export async function apiSend(method${t(config, ': string')}, path${t(config, ': string')}, body${t(config, '?: unknown')}) {
  const res = await api.request({ method, url: path, data: body });
  return res.data;
}
`;
  }

  return `const baseURL = ${base};

async function request(path${t(config, ': string')}, init${t(config, ': RequestInit')} = {})${t(config, ': Promise<any>')} {
  const res = await fetch(\`\${baseURL}\${path}\`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 401 && !path.includes('/auth/refresh')) {
    const refresh = await fetch(\`\${baseURL}/auth/refresh\`, { method: 'POST', credentials: 'include' });
    if (refresh.ok) return request(path, init);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw Object.assign(new Error(err.error?.message ?? 'Request failed'), { status: res.status, body: err });
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = { get: (path${t(config, ': string')}) => request(path), request };

export const apiGet = (path${t(config, ': string')}) => request(path);
export const apiSend = (method${t(config, ': string')}, path${t(config, ': string')}, body${t(config, '?: unknown')}) =>
  request(path, { method, body: body ? JSON.stringify(body) : undefined });
`;
}

function authService(config: StarterConfig): string {
  if (config.auth === 'none') {
    return `export async function me() { return null; }
export async function login() { throw new Error('Auth is disabled'); }
export async function register() { throw new Error('Auth is disabled'); }
export async function logout() {}
`;
  }
  return `import { apiGet, apiSend } from './api';

export function login(email${t(config, ': string')}, password${t(config, ': string')}) {
  return apiSend('POST', '/auth/login', { email, password });
}

export function register(input${t(config, ': { email: string; password: string; name?: string }')}) {
  return apiSend('POST', '/auth/register', input);
}

export function logout() {
  return apiSend('POST', '/auth/logout');
}

export function me() {
  return apiGet('/users/me');
}

export function refresh() {
  return apiSend('POST', '/auth/refresh');
}
`;
}

function zustandStore(config: StarterConfig): string {
  return `import { create } from 'zustand';
${isTs(config) ? "import type { User } from '@/types/user';\n" : ''}
${isTs(config) ? `type AuthState = {
  user: User | null;
  setUser: (user: User | null) => void;
  clear: () => void;
};

` : ''}export const useAuthStore = create${isTs(config) ? '<AuthState>' : ''}((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));
`;
}

function reduxSlice(config: StarterConfig): string {
  return `import { createSlice } from '@reduxjs/toolkit';
${isTs(config) ? "import type { PayloadAction } from '@reduxjs/toolkit';\nimport type { User } from '@/types/user';\n" : ''}
const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null${t(config, ' as User | null')} },
  reducers: {
    setUser(state, action${t(config, ': PayloadAction<User | null>')}) {
      state.user = action.payload;
    },
    clear(state) {
      state.user = null;
    },
  },
});

export const { setUser, clear } = authSlice.actions;
export const authReducer = authSlice.reducer;
`;
}

function reduxStore(config: StarterConfig): string {
  return `import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from './authSlice';

export const store = configureStore({ reducer: { auth: authReducer } });
${isTs(config) ? 'export type RootState = ReturnType<typeof store.getState>;\nexport type AppDispatch = typeof store.dispatch;\n' : ''}
`;
}

function jotaiStore(config: StarterConfig): string {
  return `import { atom } from 'jotai';
${isTs(config) ? "import type { User } from '@/types/user';\n" : ''}
export const userAtom = atom${isTs(config) ? '<User | null>' : ''}(null);
`;
}

function contextStore(config: StarterConfig): string {
  return `${client(config)}import { createContext, useContext, useMemo, useState } from 'react';
${isTs(config) ? "import type { User } from '@/types/user';\n" : ''}
const AuthStoreContext = createContext${isTs(config) ? '<{ user: User | null; setUser: (user: User | null) => void } | null>' : ''}(null);

export function AuthStoreProvider({ children }${t(config, ': { children: React.ReactNode }')}) {
  const [user, setUser] = useState${isTs(config) ? '<User | null>' : ''}(null);
  const value = useMemo(() => ({ user, setUser }), [user]);
  return <AuthStoreContext.Provider value={value}>{children}</AuthStoreContext.Provider>;
}

export function useAuthStore() {
  const ctx = useContext(AuthStoreContext);
  if (!ctx) throw new Error('AuthStoreProvider missing');
  return ctx;
}
`;
}

function useAuthHook(config: StarterConfig): string {
  const readUser =
    config.frontend.state === 'redux'
      ? `const user = useSelector((s${t(config, ': { auth: { user: User | null } }')}) => s.auth.user);
  const dispatch = useDispatch();
  const setUser = (next${t(config, ': User | null')}) => dispatch(setUserAction(next));
  const clear = () => dispatch(clearAction());`
      : config.frontend.state === 'jotai'
        ? `const [user, setUser] = useAtom(userAtom);
  const clear = () => setUser(null);`
        : config.frontend.state === 'zustand'
          ? `const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);`
          : `const { user, setUser } = useAuthStore();
  const clear = () => setUser(null);`;

  const imports = [
    `import { useCallback, useEffect, useState } from 'react';`,
    config.auth !== 'none' ? `import * as authApi from '@/services/auth';` : '',
    isTs(config) ? `import type { User } from '@/types/user';` : '',
    config.frontend.state === 'redux' ? `import { useDispatch, useSelector } from 'react-redux';\nimport { setUser as setUserAction, clear as clearAction } from '@/stores/authSlice';` : '',
    config.frontend.state === 'jotai' ? `import { useAtom } from 'jotai';\nimport { userAtom } from '@/stores/auth';` : '',
    config.frontend.state === 'zustand' ? `import { useAuthStore } from '@/stores/auth';` : '',
    config.frontend.state === 'none' ? `import { useAuthStore } from '@/stores/auth';` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `${client(config)}${imports}

export function useAuth() {
  ${readUser}
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    ${
      config.auth === 'none'
        ? 'setLoading(false);'
        : `authApi.me()
      .then((profile) => { if (!cancelled) setUser(profile); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });`
    }
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email${t(config, ': string')}, password${t(config, ': string')}) => {
    ${config.auth === 'none' ? 'return;' : `const data = await authApi.login(email, password);
    setUser(data.user ?? data);
    return data;`}
  }, []);

  const register = useCallback(async (input${t(config, ': { email: string; password: string; name?: string }')}) => {
    ${config.auth === 'none' ? 'return;' : `const data = await authApi.register(input);
    setUser(data.user ?? data);
    return data;`}
  }, []);

  const logout = useCallback(async () => {
    ${config.auth === 'none' ? 'clear();' : `await authApi.logout().catch(() => undefined);
    clear();`}
  }, []);

  return { user, loading, login, register, logout };
}
`;
}

function documentTitleHook(config: StarterConfig): string {
  return `${client(config)}import { useEffect } from 'react';

export function useDocumentTitle(title${t(config, ': string')}) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
`;
}

function pageFallback(config: StarterConfig): string {
  return `${client(config)}export function PageFallback() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, letterSpacing: '0.08em' }}>
      LOADING SHEET…
    </div>
  );
}
`;
}

function titleBlock(config: StarterConfig): string {
  return `${client(config)}import { formatSheetDate } from '@/utils/format';

export function TitleBlock({ sheet, meta }${t(config, ": { sheet: string; meta?: string }")}) {
  return (
    <div
      className="title-block"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        border: '1px solid var(--rule)',
        background: 'var(--surface)',
        fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
        fontSize: 11,
        letterSpacing: '0.04em',
      }}
    >
      <div style={{ padding: '8px 12px', borderRight: '1px solid var(--rule)' }}>
        <div style={{ color: 'var(--muted)' }}>PROJECT</div>
        <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 16, fontWeight: 600 }}>
          {${envName(config)}}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto' }}>
        <div style={{ padding: '8px 12px', borderRight: '1px solid var(--rule)' }}>
          <div style={{ color: 'var(--muted)' }}>SHEET</div>
          <div>{sheet}</div>
        </div>
        <div style={{ padding: '8px 12px' }}>
          <div style={{ color: 'var(--muted)' }}>DATE</div>
          <div>{meta ?? formatSheetDate()}</div>
        </div>
      </div>
    </div>
  );
}
`;
}

function uiButton(config: StarterConfig): string {
  const ui = config.frontend.ui;
  const props = t(config, ": { children?: React.ReactNode; variant?: 'default' | 'outline' | 'ghost'; type?: 'button' | 'submit' | 'reset'; onClick?: () => void; disabled?: boolean; className?: string }");
  if (ui === 'mui') {
    return `${client(config)}import MuiButton from '@mui/material/Button';

export function Button({ children, variant = 'default', type = 'button', onClick, disabled }${props}) {
  const mapped = variant === 'outline' ? 'outlined' : variant === 'ghost' ? 'text' : 'contained';
  return (
    <MuiButton type={type} onClick={onClick} disabled={disabled} variant={mapped} color="primary">
      {children}
    </MuiButton>
  );
}
`;
  }
  if (ui === 'antd') {
    return `${client(config)}import { Button as AntButton } from 'antd';

export function Button({ children, variant = 'default', type = 'button', onClick, disabled }${props}) {
  return (
    <AntButton htmlType={type} onClick={onClick} disabled={disabled} type={variant === 'default' ? 'primary' : 'default'} ghost={variant === 'ghost'}>
      {children}
    </AntButton>
  );
}
`;
  }
  if (ui === 'chakra') {
    return `${client(config)}import { Button as ChakraButton } from '@chakra-ui/react';

export function Button({ children, variant = 'default', type = 'button', onClick, disabled }${props}) {
  return (
    <ChakraButton type={type} onClick={onClick} isDisabled={disabled} colorScheme="orange" variant={variant === 'outline' ? 'outline' : variant === 'ghost' ? 'ghost' : 'solid'}>
      {children}
    </ChakraButton>
  );
}
`;
  }
  const shadcn = ui === 'shadcn';
  return `${client(config)}${shadcn ? "import { cva } from 'class-variance-authority';\nimport { cn } from '@/lib/utils';\n" : "import { cn } from '@/lib/cn';\n"}
${
  shadcn
    ? `const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-sm text-sm font-medium transition-colors border focus-visible:outline-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-copper text-paper border-copper hover:bg-[#9A4310]',
        outline: 'bg-transparent border-rule text-ink hover:bg-white',
        ghost: 'border-transparent hover:bg-white/80',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);
`
    : ''
}
export function Button({ children, variant = 'default', type = 'button', onClick, disabled, className }${props}) {
  const style = variant === 'default'
    ? { background: 'var(--copper)', color: 'var(--paper)', borderColor: 'var(--copper)' }
    : variant === 'outline'
      ? { background: 'transparent', color: 'var(--ink)', borderColor: 'var(--rule)' }
      : { background: 'transparent', color: 'var(--ink)', borderColor: 'transparent' };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={${shadcn ? 'cn(buttonVariants({ variant }), className)' : "cn('ui-btn', className)"}}
      style={{ ...style, fontFamily: 'IBM Plex Sans, sans-serif', height: 40, padding: '0 16px', letterSpacing: '0.04em', cursor: 'pointer' }}
    >
      {children}
    </button>
  );
}
`;
}

function uiInput(config: StarterConfig): string {
  const props = t(config, ': React.InputHTMLAttributes<HTMLInputElement> & { error?: string }');
  if (config.frontend.ui === 'mui') {
    return `${client(config)}import TextField from '@mui/material/TextField';

export function Input({ error, ...props }${props}) {
  return <TextField size="small" fullWidth error={Boolean(error)} helperText={error} {...props} />;
}
`;
  }
  if (config.frontend.ui === 'antd') {
    return `${client(config)}import { Input as AntInput, Typography } from 'antd';

export function Input({ error, ...props }${props}) {
  return (
    <div>
      <AntInput {...props} status={error ? 'error' : undefined} />
      {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
    </div>
  );
}
`;
  }
  if (config.frontend.ui === 'chakra') {
    return `${client(config)}import { Input as ChakraInput, FormErrorMessage, FormControl } from '@chakra-ui/react';

export function Input({ error, ...props }${props}) {
  return (
    <FormControl isInvalid={Boolean(error)}>
      <ChakraInput {...props} />
      {error ? <FormErrorMessage>{error}</FormErrorMessage> : null}
    </FormControl>
  );
}
`;
  }
  return `${client(config)}export function Input({ error, style, ...props }${props}) {
  return (
    <div>
      <input
        {...props}
        style={{
          width: '100%',
          height: 40,
          border: '1px solid var(--rule)',
          background: 'var(--paper)',
          color: 'var(--ink)',
          padding: '0 12px',
          fontFamily: 'IBM Plex Sans, sans-serif',
          fontVariantNumeric: 'tabular-nums',
          ...style,
        }}
      />
      {error ? <div style={{ color: 'var(--copper)', fontSize: 12, marginTop: 4 }}>{error}</div> : null}
    </div>
  );
}
`;
}

function uiCard(config: StarterConfig): string {
  const props = t(config, ': { children?: React.ReactNode; className?: string }');
  if (config.frontend.ui === 'mui') {
    return `${client(config)}import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

export function Card({ children }${props}) {
  return (
    <MuiCard variant="outlined">
      <CardContent>{children}</CardContent>
    </MuiCard>
  );
}
`;
  }
  if (config.frontend.ui === 'antd') {
    return `${client(config)}import { Card as AntCard } from 'antd';
export function Card({ children }${props}) {
  return <AntCard>{children}</AntCard>;
}
`;
  }
  if (config.frontend.ui === 'chakra') {
    return `${client(config)}import { Box } from '@chakra-ui/react';
export function Card({ children }${props}) {
  return <Box borderWidth="1px" p={6} bg="white">{children}</Box>;
}
`;
  }
  return `${client(config)}export function Card({ children }${props}) {
  return (
    <section className="sheet" style={{ padding: 24 }}>
      {children}
    </section>
  );
}
`;
}

function uiLabel(config: StarterConfig): string {
  const props = t(config, ': React.LabelHTMLAttributes<HTMLLabelElement>');
  if (config.frontend.ui === 'mui') {
    return `${client(config)}import InputLabel from '@mui/material/InputLabel';
export function Label({ children, htmlFor }${t(config, ': { children?: React.ReactNode; htmlFor?: string }')}) {
  return <InputLabel htmlFor={htmlFor}>{children}</InputLabel>;
}
`;
  }
  return `${client(config)}export function Label({ children, style, ...props }${props}) {
  return (
    <label
      {...props}
      style={{ display: 'block', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, fontFamily: 'IBM Plex Mono, monospace', ...style }}
    >
      {children}
    </label>
  );
}
`;
}

function providers(config: StarterConfig): string {
  const f = config.frontend;
  const imports: string[] = isTs(config) ? [`import type { ReactNode } from 'react';`] : [];

  if (f.state === 'redux') {
    imports.push(`import { Provider } from 'react-redux';`, `import { store } from '@/stores';`);
  }
  if (f.state === 'jotai') imports.push(`import { Provider as JotaiProvider } from 'jotai';`);
  if (f.state === 'none') imports.push(`import { AuthStoreProvider } from '@/stores/auth';`);
  if (f.serverState === 'tanstack-query') {
    imports.push(`import { QueryClient, QueryClientProvider } from '@tanstack/react-query';`);
  }
  if (f.serverState === 'swr') imports.push(`import { SWRConfig } from 'swr';`, `import { apiGet } from '@/services/api';`);
  if (f.ui === 'mui') {
    imports.push(
      `import { ThemeProvider, createTheme } from '@mui/material/styles';`,
      `import CssBaseline from '@mui/material/CssBaseline';`,
    );
  }
  if (f.ui === 'antd') imports.push(`import { ConfigProvider } from 'antd';`);
  if (f.ui === 'chakra') imports.push(`import { ChakraProvider, extendTheme } from '@chakra-ui/react';`);

  let inner = '{children}';
  if (f.ui === 'mui') {
    inner = `<ThemeProvider theme={theme}><CssBaseline />${inner}</ThemeProvider>`;
  }
  if (f.ui === 'antd') {
    inner = `<ConfigProvider theme={{ token: { colorPrimary: '#B45309', colorBgBase: '#F7F5F2', colorText: '#1C1917', fontFamily: 'IBM Plex Sans, system-ui, sans-serif', borderRadius: 2 } }}>${inner}</ConfigProvider>`;
  }
  if (f.ui === 'chakra') {
    inner = `<ChakraProvider theme={chakraTheme}>${inner}</ChakraProvider>`;
  }
  if (f.serverState === 'tanstack-query') {
    inner = `<QueryClientProvider client={queryClient}>${inner}</QueryClientProvider>`;
  }
  if (f.serverState === 'swr') {
    inner = `<SWRConfig value={{ fetcher: apiGet }}>${inner}</SWRConfig>`;
  }
  if (f.state === 'redux') inner = `<Provider store={store}>${inner}</Provider>`;
  if (f.state === 'jotai') inner = `<JotaiProvider>${inner}</JotaiProvider>`;
  if (f.state === 'none') inner = `<AuthStoreProvider>${inner}</AuthStoreProvider>`;

  return `${client(config)}${imports.join('\n')}

${f.serverState === 'tanstack-query' ? 'const queryClient = new QueryClient();\n' : ''}${
    f.ui === 'mui'
      ? `const theme = createTheme({
  palette: { primary: { main: '#B45309' }, background: { default: '#F7F5F2', paper: '#FFFcf8' }, text: { primary: '#1C1917' } },
  typography: { fontFamily: '"IBM Plex Sans", system-ui, sans-serif' },
  shape: { borderRadius: 2 },
});\n`
      : ''
  }${
    f.ui === 'chakra'
      ? `const chakraTheme = extendTheme({
  colors: { orange: { 500: '#B45309' } },
  fonts: { body: 'IBM Plex Sans, sans-serif', heading: 'IBM Plex Sans, sans-serif', mono: 'IBM Plex Mono, monospace' },
  styles: { global: { body: { bg: '#F7F5F2', color: '#1C1917' } } },
});\n`
      : ''
  }
export function Providers({ children }${t(config, ': { children: ReactNode }')}) {
  return (
    ${inner}
  );
}
`;
}

function rootLayout(config: StarterConfig): string {
  const extraImport = config.frontend.kind === 'nextjs' ? '' : "import { Outlet, Link } from 'react-router-dom';\n";
  const childrenProp = config.frontend.kind === 'nextjs' ? t(config, ': { children?: React.ReactNode }') : '';
  const link = (to: string, label: string) =>
    config.frontend.kind === 'nextjs' ? `<a href="${to}">${label}</a>` : `<Link to="${to}">${label}</Link>`;
  return `${client(config)}${extraImport}import { TitleBlock } from '@/components/TitleBlock';
import { useAuth } from '@/hooks/useAuth';

export function RootLayout(props${childrenProp || t(config, ': { children?: React.ReactNode }')}) {
  const { user, logout } = useAuth();
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <TitleBlock sheet="INDEX" />
      <nav style={{ display: 'flex', gap: 16, padding: '12px 0', fontSize: 13 }}>
        ${link('/', 'Cover')}
        ${config.auth === 'none' ? '' : link('/login', 'Login')}
        ${link('/dashboard', 'Work')}
        {user ? (
          <button type="button" onClick={() => void logout()} style={{ marginLeft: 'auto', background: 'none', border: 0, color: 'var(--copper)', cursor: 'pointer' }}>
            Sign out
          </button>
        ) : null}
      </nav>
      ${config.frontend.kind === 'nextjs' ? '{props.children}' : '<Outlet />'}
    </div>
  );
}
`;
}

function authLayout(config: StarterConfig): string {
  const extra = config.frontend.kind === 'nextjs' ? '' : "import { Outlet } from 'react-router-dom';\n";
  return `${client(config)}${extra}import { TitleBlock } from '@/components/TitleBlock';

export function AuthLayout({ children }${t(config, ': { children?: React.ReactNode }')}) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: 'min(420px, 100%)' }}>
        <TitleBlock sheet="AUTH" />
        <div style={{ height: 12 }} />
        ${config.frontend.kind === 'nextjs' ? '{children}' : '<Outlet />'}
      </div>
    </div>
  );
}
`;
}

function appLayout(config: StarterConfig): string {
  const extra = config.frontend.kind === 'nextjs' ? '' : "import { Outlet, Link } from 'react-router-dom';\n";
  const link = (to: string, label: string) =>
    config.frontend.kind === 'nextjs' ? `<a href="${to}">${label}</a>` : `<Link to="${to}">${label}</Link>`;
  return `${client(config)}${extra}import { TitleBlock } from '@/components/TitleBlock';
import { useAuth } from '@/hooks/useAuth';

export function AppLayout({ children }${t(config, ': { children?: React.ReactNode }')}) {
  const { user, logout } = useAuth();
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <TitleBlock sheet="DASH-01" meta={user?.email} />
      <div style={{ display: 'flex', gap: 16, padding: '12px 0', fontSize: 13, borderBottom: '1px solid var(--rule)' }}>
        ${link('/dashboard', 'Overview')}
        ${config.rbac !== 'none' ? link('/admin', 'Admin') : ''}
        <span style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{user?.email}</span>
        ${config.auth === 'none' ? '' : `<button type="button" onClick={() => void logout()} style={{ background: 'none', border: 0, color: 'var(--copper)', cursor: 'pointer' }}>Sign out</button>`}
      </div>
      <div style={{ paddingTop: 24 }}>${config.frontend.kind === 'nextjs' ? '{children}' : '<Outlet />'}</div>
    </div>
  );
}
`;
}

function homePage(config: StarterConfig): string {
  const extra =
    config.frontend.kind === 'nextjs' ? '' : "import { Link } from 'react-router-dom';\n";
  const cta =
    config.auth === 'none'
      ? config.frontend.kind === 'nextjs'
        ? `<a href="/dashboard"><Button>Open workspace</Button></a>`
        : `<Link to="/dashboard"><Button>Open workspace</Button></Link>`
      : config.frontend.kind === 'nextjs'
        ? `<a href="/login"><Button>Sign in</Button></a>`
        : `<Link to="/login"><Button>Sign in</Button></Link>`;
  return `${client(config)}${extra}import { TitleBlock } from '@/components/TitleBlock';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div style={{ maxWidth: 880, margin: '8vh auto', padding: 24 }}>
      <TitleBlock sheet="A-001" />
      <div className="sheet" style={{ marginTop: 16, padding: 32 }}>
        <p style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: '0.14em', color: 'var(--muted)' }}>
          PERN STARTER · ${config.architecture.toUpperCase()}
        </p>
        <h1 style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', margin: '12px 0 16px' }}>
          ${config.name}
        </h1>
        <p style={{ maxWidth: 520, lineHeight: 1.5, color: 'var(--muted)' }}>
          A production drafting table for ${config.backend.framework} and PostgreSQL.
          Copper for actions, hairline rules for structure, tabular figures for anything that counts.
        </p>
        <div style={{ marginTop: 24 }}>${cta}</div>
      </div>
    </div>
  );
}
`;
}

function loginPage(config: StarterConfig): string {
  return `${client(config)}import { AuthLayout } from '@/layouts/AuthLayout';
import { LoginForm } from '@/features/auth/LoginForm';
import { Card } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <AuthLayout>
      <Card>
        <h1 style={{ marginTop: 0, fontSize: 22 }}>Sign in</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Use the account issued for this sheet.</p>
        <LoginForm />
      </Card>
    </AuthLayout>
  );
}
`;
}

function registerPage(config: StarterConfig): string {
  return `${client(config)}import { AuthLayout } from '@/layouts/AuthLayout';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { Card } from '@/components/ui/card';

export default function RegisterPage() {
  return (
    <AuthLayout>
      <Card>
        <h1 style={{ marginTop: 0, fontSize: 22 }}>Register</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Create credentials. Refresh tokens stay in an HttpOnly cookie.</p>
        <RegisterForm />
      </Card>
    </AuthLayout>
  );
}
`;
}

function dashboardPage(config: StarterConfig): string {
  return `${client(config)}import { AppLayout } from '@/layouts/AppLayout';
import { Overview } from '@/features/dashboard/Overview';

export default function DashboardPage() {
  return (
    <AppLayout>
      <Overview />
    </AppLayout>
  );
}
`;
}

function adminPlaceholder(config: StarterConfig): string {
  return `${client(config)}import { AppLayout } from '@/layouts/AppLayout';

export default function AdminPlaceholder() {
  return (
    <AppLayout>
      <p>Admin tools live ${config.admin === 'none' ? 'behind RBAC once an admin app is generated.' : 'in the admin application.'}</p>
    </AppLayout>
  );
}
`;
}

function loginForm(config: StarterConfig): string {
  const nav =
    config.frontend.kind === 'nextjs'
      ? `window.location.href = '/dashboard';`
      : `navigate('/dashboard');`;
  const navImport =
    config.frontend.kind === 'nextjs' ? '' : "import { useNavigate, Link } from 'react-router-dom';\n";
  const linkReg =
    config.frontend.kind === 'nextjs' ? `<a href="/register">Register</a>` : `<Link to="/register">Register</Link>`;

  if (config.frontend.forms === 'react-hook-form') {
    const resolver = resolverImport(config);
    return `${client(config)}import { useForm } from 'react-hook-form';
${resolver.import}
${navImport}import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

${resolver.schema}

export function LoginForm() {
  ${config.frontend.kind === 'nextjs' ? '' : 'const navigate = useNavigate();'}
  const { login } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm${resolver.generic}({
    ${resolver.use}
  });

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        try {
          await login(values.email, values.password);
          ${nav}
        } catch (err) {
          setError('password', { message: err instanceof Error ? err.message : 'Sign in failed' });
        }
      })}
      style={{ display: 'grid', gap: 14 }}
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" {...register('password')} error={errors.password?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Checking…' : 'Enter'}</Button>
      <p style={{ fontSize: 13 }}>No sheet yet? ${linkReg}</p>
    </form>
  );
}
`;
  }

  if (config.frontend.forms === 'formik') {
    return `${client(config)}import { Formik, Form, Field } from 'formik';
${navImport}import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  ${config.frontend.kind === 'nextjs' ? '' : 'const navigate = useNavigate();'}
  const { login } = useAuth();
  return (
    <Formik
      initialValues={{ email: '', password: '' }}
      onSubmit={async (values, helpers) => {
        try {
          await login(values.email, values.password);
          ${nav}
        } catch (err) {
          helpers.setFieldError('password', err instanceof Error ? err.message : 'Sign in failed');
        }
      }}
    >
      {({ isSubmitting, errors }) => (
        <Form style={{ display: 'grid', gap: 14 }}>
          <div>
            <Label htmlFor="email">Email</Label>
            <Field id="email" name="email" type="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Field id="password" name="password" type="password" />
            {errors.password ? <div style={{ color: 'var(--copper)', fontSize: 12 }}>{errors.password}</div> : null}
          </div>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Checking…' : 'Enter'}</Button>
          <p style={{ fontSize: 13 }}>No sheet yet? ${linkReg}</p>
        </Form>
      )}
    </Formik>
  );
}
`;
  }

  return `${client(config)}import { useState } from 'react';
${navImport}import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  ${config.frontend.kind === 'nextjs' ? '' : 'const navigate = useNavigate();'}
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError('');
        try {
          await login(email, password);
          ${nav}
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Sign in failed');
        } finally {
          setPending(false);
        }
      }}
      style={{ display: 'grid', gap: 14 }}
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Checking…' : 'Enter'}</Button>
      <p style={{ fontSize: 13 }}>No sheet yet? ${linkReg}</p>
    </form>
  );
}
`;
}

function registerForm(config: StarterConfig): string {
  const nav = config.frontend.kind === 'nextjs' ? `window.location.href = '/dashboard';` : `navigate('/dashboard');`;
  const navImport = config.frontend.kind === 'nextjs' ? '' : "import { useNavigate, Link } from 'react-router-dom';\n";
  const linkLogin = config.frontend.kind === 'nextjs' ? `<a href="/login">Sign in</a>` : `<Link to="/login">Sign in</Link>`;
  return `${client(config)}import { useState } from 'react';
${navImport}import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RegisterForm() {
  ${config.frontend.kind === 'nextjs' ? '' : 'const navigate = useNavigate();'}
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError('');
        try {
          await register({ email, password, name });
          ${nav}
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Register failed');
        } finally {
          setPending(false);
        }
      }}
      style={{ display: 'grid', gap: 14 }}
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Filing…' : 'Create account'}</Button>
      <p style={{ fontSize: 13 }}>Already registered? ${linkLogin}</p>
    </form>
  );
}
`;
}

function resolverImport(config: StarterConfig): { import: string; schema: string; use: string; generic: string } {
  const v = config.frontend.validation;
  if (v === 'yup') {
    return {
      import: `import { yupResolver } from '@hookform/resolvers/yup';\nimport * as yup from 'yup';`,
      schema: `const schema = yup.object({ email: yup.string().email().required(), password: yup.string().min(8).required() });`,
      use: 'resolver: yupResolver(schema)',
      generic: '',
    };
  }
  if (v === 'valibot') {
    return {
      import: `import { valibotResolver } from '@hookform/resolvers/valibot';\nimport * as v from 'valibot';`,
      schema: `const schema = v.object({ email: v.pipe(v.string(), v.email()), password: v.pipe(v.string(), v.minLength(8)) });`,
      use: 'resolver: valibotResolver(schema)',
      generic: '',
    };
  }
  if (v === 'joi') {
    return {
      import: `import { joiResolver } from '@hookform/resolvers/joi';\nimport Joi from 'joi';`,
      schema: `const schema = Joi.object({ email: Joi.string().email({ tlds: false }).required(), password: Joi.string().min(8).required() });`,
      use: 'resolver: joiResolver(schema)',
      generic: '',
    };
  }
  return {
    import: `import { zodResolver } from '@hookform/resolvers/zod';\nimport { z } from 'zod';`,
    schema: `const schema = z.object({ email: z.string().email(), password: z.string().min(8) });`,
    use: 'resolver: zodResolver(schema)',
    generic: '',
  };
}

function overview(config: StarterConfig): string {
  const query =
    config.frontend.serverState === 'tanstack-query'
      ? `import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/services/api';

export function Overview() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => apiGet('/health') });
  const status = health.data?.status ?? (health.isLoading ? 'checking' : 'unknown');
`
      : config.frontend.serverState === 'swr'
        ? `import useSWR from 'swr';

export function Overview() {
  const { data, isLoading } = useSWR('/health');
  const status = data?.status ?? (isLoading ? 'checking' : 'unknown');
`
        : `import { useEffect, useState } from 'react';
import { apiGet } from '@/services/api';

export function Overview() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    apiGet('/health').then((d) => setStatus(d.status ?? 'ok')).catch(() => setStatus('offline'));
  }, []);
`;

  return `${client(config)}${query}
  return (
    <div>
      <h1 style={{ fontSize: 24, marginTop: 0 }}>Workspace</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>
        <tbody>
          <tr>
            <td style={{ borderBottom: '1px solid var(--rule)', padding: '10px 0', color: 'var(--muted)' }}>API</td>
            <td style={{ borderBottom: '1px solid var(--rule)', padding: '10px 0', textAlign: 'right' }}>{String(status)}</td>
          </tr>
          <tr>
            <td style={{ borderBottom: '1px solid var(--rule)', padding: '10px 0', color: 'var(--muted)' }}>Auth</td>
            <td style={{ borderBottom: '1px solid var(--rule)', padding: '10px 0', textAlign: 'right' }}>${config.auth}</td>
          </tr>
          <tr>
            <td style={{ padding: '10px 0', color: 'var(--muted)' }}>ORM</td>
            <td style={{ padding: '10px 0', textAlign: 'right' }}>${config.orm}</td>
          </tr>
        </tbody>
      </table>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>Server lists belong in query hooks, not the auth store.</p>
    </div>
  );
}
`;
}

function publicRoutes(config: StarterConfig): string {
  return `export const publicPaths = ['/', ${config.auth === 'none' ? "'/dashboard'" : "'/login', '/register'"}];
export const guestPaths = ${config.auth === 'none' ? '[]' : "['/login', '/register']"};
`;
}

function protectedRoutes(config: StarterConfig): string {
  if (config.auth === 'none') {
    return `import { Outlet } from 'react-router-dom';
export function ProtectedRoute() { return <Outlet />; }
export function GuestRoute() { return <Outlet />; }
export function RoleRoute() { return <Outlet />; }
`;
  }
  return `import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PageFallback } from '@/components/PageFallback';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function RoleRoute({ roles }${t(config, ': { roles: string[] }')}) {
  const { user, loading } = useAuth();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to="/login" replace />;
  const allowed = roles.some((role) => user.roles?.includes(role));
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
`;
}

function routeIndex(config: StarterConfig): string {
  const lazyAuth =
    config.auth === 'none'
      ? ''
      : `const LoginPage = lazy(() => import('@/pages/Login'));
const RegisterPage = lazy(() => import('@/pages/Register'));`;
  const guest =
    config.auth === 'none'
      ? ''
      : `<Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>`;
  const role =
    config.rbac === 'none' || config.admin === 'custom'
      ? ''
      : `<Route element={<RoleRoute roles={['admin']} />}>
          <Route path="/admin" element={<DashboardPage />} />
        </Route>`;
  return `import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageFallback } from '@/components/PageFallback';
import { GuestRoute, ProtectedRoute${config.rbac !== 'none' ? ', RoleRoute' : ''} } from './protected';
${config.admin === 'custom' ? "import { adminRouteElements } from './admin';" : ''}

const HomePage = lazy(() => import('@/pages/Home'));
const DashboardPage = lazy(() => import('@/pages/Dashboard'));
${lazyAuth}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        ${guest}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
        </Route>
        ${config.admin === 'custom' ? '{adminRouteElements}' : ''}
        ${role}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
`;
}

function extOf(config: StarterConfig, react = false): string {
  return react ? (isTs(config) ? 'tsx' : 'jsx') : isTs(config) ? 'ts' : 'js';
}
