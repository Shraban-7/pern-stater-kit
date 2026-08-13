import * as p from '@clack/prompts';
import { ARCHITECTURE_CATALOG } from '../architectures/catalog.js';
import { createDefaultConfig } from '../core/defaults.js';
import type {
  AdminDashboard,
  ApiStyle,
  ArchitectureId,
  AuthStrategy,
  BackendFramework,
  CacheProvider,
  CicdProvider,
  DockerMode,
  EmailProviderId,
  FrontendKind,
  Language,
  LoggingLib,
  MonitoringOption,
  MultiTenancy,
  Orm,
  PackageManager,
  PatternId,
  PaymentProviderId,
  QueueProvider,
  RbacStrategy,
  SearchProviderId,
  StarterConfig,
  StorageProviderId,
  UiFramework,
  WebsocketProvider,
} from '../core/types.js';
import { PATTERN_CATALOG } from '../patterns/catalog.js';
import { handleCancel, printConfigSummary } from './print.js';

function opt<T extends string>(value: T, label: string, hint?: string): { value: T; label: string; hint?: string } {
  return hint ? { value, label, hint } : { value, label };
}

export interface WizardOptions {
  name?: string;
  defaults?: StarterConfig;
}

export async function runWizard(options: WizardOptions = {}): Promise<StarterConfig> {
  const base = options.defaults ?? createDefaultConfig(options.name ?? 'my-app');

  p.intro('Configure your PERN project');

  const name = handleCancel(
    await p.text({
      message: 'Project name',
      initialValue: options.name ?? base.name,
      validate: (value) => {
        if (!value?.trim()) return 'Project name is required';
        if (!/^[a-zA-Z][a-zA-Z0-9-_]*$/.test(value.trim())) {
          return 'Must start with a letter and contain only letters, numbers, hyphens, and underscores';
        }
        return undefined;
      },
    }),
  );

  const packageManager = handleCancel(
    await p.select({
      message: 'Package manager',
      initialValue: base.packageManager,
      options: [
        opt<PackageManager>('pnpm', 'pnpm', 'Recommended'),
        opt<PackageManager>('npm', 'npm'),
        opt<PackageManager>('yarn', 'Yarn'),
        opt<PackageManager>('bun', 'Bun'),
      ],
    }),
  );

  const nodeVersion = handleCancel(
    await p.select({
      message: 'Node version',
      initialValue: ['20', '22', '24'].includes(base.nodeVersion) ? base.nodeVersion : '20',
      options: [
        opt('20', '20 LTS', 'Recommended'),
        opt('22', '22 LTS'),
        opt('24', '24'),
      ],
    }),
  );

  const language = handleCancel(
    await p.select({
      message: 'Language',
      initialValue: base.language,
      options: [
        opt<Language>('typescript', 'TypeScript', 'Default, strict mode'),
        opt<Language>('javascript', 'JavaScript'),
      ],
    }),
  );

  const architecture = handleCancel(
    await p.select({
      message: 'Architecture',
      initialValue: base.architecture,
      options: ARCHITECTURE_CATALOG.filter((item) => item.id !== 'monorepo').map((item) =>
        opt<ArchitectureId>(item.id, item.name, item.description),
      ),
    }),
  );

  const designPatterns = handleCancel(
    await p.multiselect({
      message: 'Design patterns',
      initialValues: base.designPatterns,
      required: false,
      options: PATTERN_CATALOG.map((item) => ({
        value: item.id,
        label: item.name,
        hint: item.warn ?? item.description,
      })) as never,
    }),
  );

  if (designPatterns.includes('singleton')) {
    p.log.warn('Singleton is rarely needed in Node.js. Prefer dependency injection.');
  }

  const backendFramework = handleCancel(
    await p.select({
      message: 'Backend framework',
      initialValue: base.backend.framework,
      options: [
        opt<BackendFramework>('express', 'Express', 'Recommended'),
        opt<BackendFramework>('fastify', 'Fastify'),
      ],
    }),
  );

  const apiStyle = handleCancel(
    await p.select({
      message: 'API style',
      initialValue: base.backend.api,
      options: [
        opt<ApiStyle>('rest', 'REST', 'Recommended'),
        opt<ApiStyle>('graphql', 'GraphQL'),
        opt<ApiStyle>('rest+graphql', 'REST + GraphQL'),
      ],
    }),
  );

  let graphqlServer = base.backend.graphqlServer;
  if (apiStyle.includes('graphql')) {
    graphqlServer = handleCancel(
      await p.select({
        message: 'GraphQL server',
        initialValue: base.backend.graphqlServer ?? 'apollo',
        options: [
          opt('apollo', 'Apollo Server'),
          opt('yoga', 'GraphQL Yoga'),
        ],
      }),
    );
  }

  const orm = handleCancel(
    await p.select({
      message: 'Database ORM',
      initialValue: base.orm,
      options: [
        opt<Orm>('prisma', 'Prisma', 'Recommended'),
        opt<Orm>('drizzle', 'Drizzle'),
        opt<Orm>('typeorm', 'TypeORM'),
        opt<Orm>('sequelize', 'Sequelize'),
        opt<Orm>('knex', 'Knex'),
        opt<Orm>('pg', 'node-postgres (raw)'),
      ],
    }),
  );

  p.log.info('Database: PostgreSQL');

  const auth = handleCancel(
    await p.select({
      message: 'Authentication',
      initialValue: base.auth,
      options: [
        opt<AuthStrategy>('jwt-refresh-token', 'JWT + Refresh Token', 'Recommended'),
        opt<AuthStrategy>('jwt', 'JWT'),
        opt<AuthStrategy>('session', 'Session cookies'),
        opt<AuthStrategy>('oauth2', 'OAuth2'),
        opt<AuthStrategy>('none', 'None'),
      ],
    }),
  );

  const rbac = handleCancel(
    await p.select({
      message: 'Authorization / RBAC',
      initialValue: auth === 'none' ? 'none' : base.rbac,
      options: [
        opt<RbacStrategy>('custom', 'Custom roles & permissions', 'Recommended'),
        opt<RbacStrategy>('casl', 'CASL'),
        opt<RbacStrategy>('accesscontrol', 'accesscontrol'),
        opt<RbacStrategy>('none', 'None'),
      ],
    }),
  );

  const frontendKind = handleCancel(
    await p.select({
      message: 'Frontend',
      initialValue: base.frontend.kind === 'nextjs' ? 'vite-react' : base.frontend.kind,
      options: [
        opt<FrontendKind>('vite-react', 'React + Vite', 'Used here — recommended'),
        opt<FrontendKind>('none', 'API only'),
      ],
    }),
  );

  let ui: UiFramework = frontendKind === 'none' ? 'none' : base.frontend.ui;
  let state = frontendKind === 'none' ? ('none' as const) : base.frontend.state;
  let serverState = frontendKind === 'none' ? ('none' as const) : base.frontend.serverState;
  let forms = frontendKind === 'none' ? ('none' as const) : base.frontend.forms;
  let apiClient = frontendKind === 'none' ? ('fetch' as const) : base.frontend.apiClient;

  if (frontendKind !== 'none') {
    ui = handleCancel(
      await p.select({
        message: 'UI framework',
        initialValue: base.frontend.ui === 'none' ? 'shadcn' : base.frontend.ui,
        options: [
          opt<UiFramework>('shadcn', 'shadcn/ui', 'Tailwind + recommended'),
          opt<UiFramework>('tailwind', 'Tailwind CSS'),
          opt<UiFramework>('mui', 'Material UI'),
          opt<UiFramework>('antd', 'Ant Design'),
          opt<UiFramework>('chakra', 'Chakra UI'),
          opt<UiFramework>('headless', 'Headless UI'),
          opt<UiFramework>('none', 'None'),
        ],
      }),
    );

    state = handleCancel(
      await p.select({
        message: 'State management',
        initialValue: base.frontend.state === 'none' ? 'zustand' : base.frontend.state,
        options: [
          opt('zustand', 'Zustand', 'Recommended'),
          opt('redux', 'Redux Toolkit'),
          opt('jotai', 'Jotai'),
          opt('none', 'None'),
        ],
      }),
    );

    serverState = handleCancel(
      await p.select({
        message: 'Data fetching',
        initialValue: base.frontend.serverState === 'none' ? 'tanstack-query' : base.frontend.serverState,
        options: [
          opt('tanstack-query', 'TanStack Query', 'Recommended'),
          opt('swr', 'SWR'),
          opt('none', 'None'),
        ],
      }),
    );

    forms = handleCancel(
      await p.select({
        message: 'Form library',
        initialValue: base.frontend.forms === 'none' ? 'react-hook-form' : base.frontend.forms,
        options: [
          opt('react-hook-form', 'React Hook Form', 'Recommended'),
          opt('formik', 'Formik'),
          opt('none', 'None'),
        ],
      }),
    );

    apiClient = handleCancel(
      await p.select({
        message: 'API client',
        initialValue: base.frontend.apiClient,
        options: [
          opt('axios', 'Axios', 'Recommended'),
          opt('fetch', 'Fetch'),
        ],
      }),
    );
  }

  const validation = handleCancel(
    await p.select({
      message: 'Validation',
      initialValue: base.validation,
      options: [
        opt('zod', 'Zod', 'Recommended'),
        opt('yup', 'Yup'),
        opt('valibot', 'Valibot'),
        opt('joi', 'Joi'),
      ],
    }),
  );

  const cache = handleCancel(
    await p.select({
      message: 'Cache',
      initialValue: base.cache,
      options: [
        opt<CacheProvider>('none', 'None'),
        opt<CacheProvider>('redis', 'Redis'),
      ],
    }),
  );

  const queue = handleCancel(
    await p.select({
      message: 'Queue',
      initialValue: base.queue,
      options: [
        opt<QueueProvider>('none', 'None'),
        opt<QueueProvider>('bullmq', 'BullMQ', 'Requires Redis'),
      ],
    }),
  );

  const storage = handleCancel(
    await p.select({
      message: 'Storage',
      initialValue: base.storage,
      options: [
        opt<StorageProviderId>('none', 'None'),
        opt<StorageProviderId>('local', 'Local disk'),
        opt<StorageProviderId>('s3', 'AWS S3'),
        opt<StorageProviderId>('r2', 'Cloudflare R2'),
        opt<StorageProviderId>('minio', 'MinIO'),
      ],
    }),
  );

  const email = handleCancel(
    await p.select({
      message: 'Email',
      initialValue: base.email,
      options: [
        opt<EmailProviderId>('none', 'None'),
        opt<EmailProviderId>('smtp', 'SMTP'),
        opt<EmailProviderId>('resend', 'Resend'),
        opt<EmailProviderId>('sendgrid', 'SendGrid'),
        opt<EmailProviderId>('ses', 'Amazon SES'),
        opt<EmailProviderId>('mailgun', 'Mailgun'),
        opt<EmailProviderId>('postmark', 'Postmark'),
      ],
    }),
  );

  const oauthProviders = handleCancel(
    await p.multiselect({
      message: 'Social login / OAuth providers',
      initialValues: base.oauthProviders,
      required: false,
      options: [
        opt('google', 'Google'),
        opt('github', 'GitHub'),
        opt('facebook', 'Facebook'),
        opt('microsoft', 'Microsoft'),
        opt('apple', 'Apple'),
        opt('linkedin', 'LinkedIn'),
      ],
    }),
  );

  const payments = handleCancel(
    await p.multiselect({
      message: 'Payments',
      initialValues: base.payments,
      required: false,
      options: [
        opt<PaymentProviderId>('stripe', 'Stripe'),
        opt<PaymentProviderId>('paypal', 'PayPal'),
        opt<PaymentProviderId>('bkash', 'bKash'),
        opt<PaymentProviderId>('nagad', 'Nagad'),
        opt<PaymentProviderId>('sslcommerz', 'SSLCommerz'),
        opt<PaymentProviderId>('razorpay', 'Razorpay'),
      ],
    }),
  );

  const websockets = handleCancel(
    await p.select({
      message: 'WebSockets',
      initialValue: base.websockets,
      options: [
        opt<WebsocketProvider>('none', 'None'),
        opt<WebsocketProvider>('socket.io', 'Socket.IO'),
        opt<WebsocketProvider>('ws', 'ws'),
      ],
    }),
  );

  const search = handleCancel(
    await p.select({
      message: 'Search',
      initialValue: base.search,
      options: [
        opt<SearchProviderId>('none', 'None'),
        opt<SearchProviderId>('postgres-fts', 'PostgreSQL full-text'),
        opt<SearchProviderId>('meilisearch', 'Meilisearch'),
        opt<SearchProviderId>('elasticsearch', 'Elasticsearch'),
        opt<SearchProviderId>('opensearch', 'OpenSearch'),
      ],
    }),
  );

  const monitoring = handleCancel(
    await p.multiselect({
      message: 'Monitoring',
      initialValues: base.monitoring.length ? base.monitoring : ['health'],
      required: false,
      options: [
        opt<MonitoringOption>('health', 'Health checks'),
        opt<MonitoringOption>('sentry', 'Sentry'),
        opt<MonitoringOption>('opentelemetry', 'OpenTelemetry'),
        opt<MonitoringOption>('prometheus', 'Prometheus'),
      ],
    }),
  );

  const logging = handleCancel(
    await p.select({
      message: 'Logging',
      initialValue: base.logging,
      options: [
        opt<LoggingLib>('pino', 'Pino', 'Recommended'),
        opt<LoggingLib>('winston', 'Winston'),
      ],
    }),
  );

  const unit = handleCancel(
    await p.select({
      message: 'Unit testing',
      initialValue: base.testing.unit,
      options: [
        opt('vitest', 'Vitest', 'Recommended'),
        opt('jest', 'Jest'),
      ],
    }),
  );

  const e2e = handleCancel(
    await p.select({
      message: 'E2E testing',
      initialValue: frontendKind === 'none' ? 'none' : base.testing.e2e,
      options: [
        opt('playwright', 'Playwright', 'Recommended'),
        opt('cypress', 'Cypress'),
        opt('none', 'None'),
      ],
    }),
  );

  const docker = handleCancel(
    await p.select({
      message: 'Docker',
      initialValue: base.docker,
      options: [
        opt<DockerMode>('none', 'None'),
        opt<DockerMode>('dev', 'Development Compose'),
        opt<DockerMode>('dev+prod', 'Development + production'),
      ],
    }),
  );

  const cicd = handleCancel(
    await p.select({
      message: 'CI/CD',
      initialValue: base.cicd,
      options: [
        opt<CicdProvider>('none', 'None'),
        opt<CicdProvider>('github-actions', 'GitHub Actions'),
        opt<CicdProvider>('gitlab-ci', 'GitLab CI'),
      ],
    }),
  );

  const deployment = handleCancel(
    await p.multiselect({
      message: 'Deployment targets',
      initialValues: base.deployment,
      required: false,
      options: [
        opt('docker', 'Docker'),
        opt('render', 'Render'),
        opt('fly', 'Fly.io'),
        opt('railway', 'Railway'),
        opt('vps', 'VPS'),
      ],
    }),
  );

  const admin = handleCancel(
    await p.select({
      message: 'Admin dashboard',
      initialValue: frontendKind === 'none' ? 'none' : base.admin,
      options:
        frontendKind === 'none'
          ? [opt<AdminDashboard>('none', 'None')]
          : [
              opt<AdminDashboard>('none', 'None'),
              opt<AdminDashboard>('custom', 'Custom React admin'),
              opt<AdminDashboard>('refine', 'Refine'),
              opt<AdminDashboard>('react-admin', 'React Admin'),
            ],
    }),
  );

  const multiTenancy = handleCancel(
    await p.select({
      message: 'Multi-tenancy',
      initialValue: base.multiTenancy,
      options: [
        opt<MultiTenancy>('none', 'None'),
        opt<MultiTenancy>('shared-db', 'Shared database'),
        opt<MultiTenancy>('db-per-tenant', 'Database per tenant'),
      ],
    }),
  );

  const architectures: ArchitectureId[] = [architecture];
  if (frontendKind !== 'none') architectures.push('monorepo');
  if (multiTenancy !== 'none') architectures.push('multi-tenant');

  const config: StarterConfig = {
    ...base,
    name: name.trim(),
    language,
    packageManager,
    nodeVersion,
    architecture,
    architectures: [...new Set(architectures)],
    designPatterns: designPatterns as PatternId[],
    backend: {
      framework: backendFramework,
      api: apiStyle,
      ...(apiStyle.includes('graphql') ? { graphqlServer } : {}),
    },
    orm,
    auth,
    oauthProviders: oauthProviders as StarterConfig['oauthProviders'],
    rbac: auth === 'none' && rbac === 'custom' ? 'none' : rbac,
    frontend: {
      kind: frontendKind,
      ui,
      state,
      serverState,
      forms,
      validation,
      apiClient,
      router: frontendKind !== 'none',
    },
    cache,
    queue,
    storage,
    email,
    payments: payments as StarterConfig['payments'],
    websockets,
    search,
    logging,
    monitoring: (monitoring.length ? monitoring : ['health']) as StarterConfig['monitoring'],
    testing: { unit, e2e: frontendKind === 'none' ? 'none' : e2e },
    docker,
    cicd,
    deployment: deployment as string[],
    admin,
    multiTenancy,
    validation,
    monorepo: frontendKind === 'none' ? 'none' : base.monorepo === 'none' ? 'turborepo' : base.monorepo,
  };

  return config;
}

export async function confirmGeneration(config: StarterConfig, yes?: boolean): Promise<boolean> {
  printConfigSummary(config);
  if (yes) return true;
  const answer = await p.confirm({
    message: 'Generate project?',
    initialValue: true,
  });
  return handleCancel(answer);
}
