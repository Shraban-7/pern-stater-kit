import type { StarterConfig } from './types';

function Field({
  label,
  children,
  span,
}: {
  label: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <label className={span ? 'field span' : 'field'}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={on ? 'chip on' : 'chip'} onClick={onClick}>
      {label}
    </button>
  );
}

const PAYMENTS = ['stripe', 'paypal', 'bkash', 'nagad', 'sslcommerz', 'razorpay'];

export function OptionsPanel({
  config,
  onChange,
  onClose,
}: {
  config: StarterConfig;
  onChange: (next: (current: StarterConfig) => StarterConfig) => void;
  onClose: () => void;
}) {
  return (
    <aside className="drawer" aria-label="Project options">
      <div className="drawer-head">
        <h2>Options</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="grid">
        <Field label="Language">
          <select
            value={config.language}
            onChange={(event) =>
              onChange((c) => ({ ...c, language: event.target.value as StarterConfig['language'] }))
            }
          >
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
          </select>
        </Field>
        <Field label="Package manager">
          <select
            value={config.packageManager}
            onChange={(event) =>
              onChange((c) => ({
                ...c,
                packageManager: event.target.value as StarterConfig['packageManager'],
              }))
            }
          >
            <option value="pnpm">pnpm</option>
            <option value="npm">npm</option>
            <option value="yarn">yarn</option>
            <option value="bun">bun</option>
          </select>
        </Field>
        <Field label="Architecture">
          <select
            value={config.architecture}
            onChange={(event) =>
              onChange((c) => ({
                ...c,
                architecture: event.target.value,
                architectures: [event.target.value, 'monorepo'],
              }))
            }
          >
            <option value="modular-monolith">Modular monolith</option>
            <option value="layered">Layered</option>
            <option value="simple-mvc">Simple MVC</option>
            <option value="clean">Clean</option>
            <option value="hexagonal">Hexagonal</option>
            <option value="ddd">DDD</option>
          </select>
        </Field>
        <Field label="Backend">
          <select
            value={config.backend.framework}
            onChange={(event) =>
              onChange((c) => ({
                ...c,
                backend: {
                  ...c.backend,
                  framework: event.target.value as StarterConfig['backend']['framework'],
                },
              }))
            }
          >
            <option value="express">Express</option>
            <option value="fastify">Fastify</option>
          </select>
        </Field>
        <Field label="ORM">
          <select
            value={config.orm}
            onChange={(event) => onChange((c) => ({ ...c, orm: event.target.value }))}
          >
            <option value="prisma">Prisma</option>
            <option value="drizzle">Drizzle</option>
            <option value="typeorm">TypeORM</option>
            <option value="sequelize">Sequelize</option>
            <option value="knex">Knex</option>
            <option value="pg">node-postgres</option>
          </select>
        </Field>
        <Field label="Auth">
          <select
            value={config.auth}
            onChange={(event) => onChange((c) => ({ ...c, auth: event.target.value }))}
          >
            <option value="jwt-refresh-token">JWT + refresh</option>
            <option value="jwt">JWT</option>
            <option value="session">Session</option>
            <option value="oauth2">OAuth2</option>
            <option value="none">None</option>
          </select>
        </Field>
        <Field label="RBAC">
          <select
            value={config.rbac}
            onChange={(event) => onChange((c) => ({ ...c, rbac: event.target.value }))}
          >
            <option value="custom">Custom</option>
            <option value="casl">CASL</option>
            <option value="accesscontrol">accesscontrol</option>
            <option value="none">None</option>
          </select>
        </Field>
        <Field label="App">
          <select
            value={config.frontend.kind}
            onChange={(event) => {
              const kind = event.target.value as StarterConfig['frontend']['kind'];
              onChange((c) => ({
                ...c,
                frontend: {
                  ...c.frontend,
                  kind,
                  ui: kind === 'none' ? 'none' : c.frontend.ui === 'none' ? 'shadcn' : c.frontend.ui,
                  state: kind === 'none' ? 'none' : c.frontend.state === 'none' ? 'zustand' : c.frontend.state,
                  serverState:
                    kind === 'none'
                      ? 'none'
                      : c.frontend.serverState === 'none'
                        ? 'tanstack-query'
                        : c.frontend.serverState,
                },
                monorepo: kind === 'none' ? 'none' : 'turborepo',
              }));
            }}
          >
            <option value="vite-react">React + Vite</option>
            <option value="none">API only</option>
          </select>
        </Field>
        <Field label="UI">
          <select
            disabled={config.frontend.kind === 'none'}
            value={config.frontend.ui}
            onChange={(event) =>
              onChange((c) => ({ ...c, frontend: { ...c.frontend, ui: event.target.value } }))
            }
          >
            <option value="shadcn">Tailwind + shadcn</option>
            <option value="tailwind">Tailwind</option>
            <option value="mui">MUI</option>
            <option value="antd">Ant Design</option>
            <option value="chakra">Chakra</option>
            <option value="none">None</option>
          </select>
        </Field>
        <Field label="Client state">
          <select
            disabled={config.frontend.kind === 'none'}
            value={config.frontend.state}
            onChange={(event) =>
              onChange((c) => ({ ...c, frontend: { ...c.frontend, state: event.target.value } }))
            }
          >
            <option value="zustand">Zustand</option>
            <option value="redux">Redux Toolkit</option>
            <option value="jotai">Jotai</option>
            <option value="none">None</option>
          </select>
        </Field>
        <Field label="Server state">
          <select
            disabled={config.frontend.kind === 'none'}
            value={config.frontend.serverState}
            onChange={(event) =>
              onChange((c) => ({
                ...c,
                frontend: { ...c.frontend, serverState: event.target.value },
              }))
            }
          >
            <option value="tanstack-query">TanStack Query</option>
            <option value="swr">SWR</option>
            <option value="none">None</option>
          </select>
        </Field>
        <Field label="Cache">
          <select
            value={config.cache}
            onChange={(event) =>
              onChange((c) => ({ ...c, cache: event.target.value as StarterConfig['cache'] }))
            }
          >
            <option value="none">None</option>
            <option value="redis">Redis</option>
          </select>
        </Field>
        <Field label="Queue">
          <select
            value={config.queue}
            onChange={(event) => {
              const queue = event.target.value as StarterConfig['queue'];
              onChange((c) => ({ ...c, queue, cache: queue === 'bullmq' ? 'redis' : c.cache }));
            }}
          >
            <option value="none">None</option>
            <option value="bullmq">BullMQ</option>
          </select>
        </Field>
        <Field label="Docker">
          <select
            value={config.docker}
            onChange={(event) =>
              onChange((c) => ({ ...c, docker: event.target.value as StarterConfig['docker'] }))
            }
          >
            <option value="none">None</option>
            <option value="dev">Development</option>
            <option value="dev+prod">Dev + production</option>
          </select>
        </Field>
        <Field label="Email">
          <select
            value={config.email}
            onChange={(event) => onChange((c) => ({ ...c, email: event.target.value }))}
          >
            <option value="none">None</option>
            <option value="resend">Resend</option>
            <option value="smtp">SMTP</option>
            <option value="sendgrid">SendGrid</option>
            <option value="ses">SES</option>
          </select>
        </Field>
      </div>

      <div className="section">Payments</div>
      <div className="chips">
        {PAYMENTS.map((id) => (
          <Chip
            key={id}
            label={id}
            on={config.payments.includes(id)}
            onClick={() =>
              onChange((c) => ({
                ...c,
                payments: c.payments.includes(id)
                  ? c.payments.filter((item) => item !== id)
                  : [...c.payments, id],
              }))
            }
          />
        ))}
      </div>
    </aside>
  );
}
