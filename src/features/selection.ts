import type { StarterConfig } from '../core/types.js';

export function featuresFromConfig(config: StarterConfig): string[] {
  const ids = new Set<string>(config.features);

  ids.add(`language-${config.language}`);
  ids.add(`pm-${config.packageManager}`);
  ids.add(`backend-${config.backend.framework}`);
  ids.add(`api-${config.backend.api === 'rest+graphql' ? 'rest' : config.backend.api}`);
  if (config.backend.api === 'rest+graphql') {
    ids.add('api-rest');
    ids.add('api-graphql');
  }
  if (config.backend.graphqlServer) ids.add(`graphql-${config.backend.graphqlServer}`);
  ids.add(`orm-${config.orm}`);
  ids.add('db-postgresql');
  ids.add(`auth-${config.auth}`);
  if (config.auth !== 'none') ids.add(`hash-${config.passwordHash}`);
  for (const provider of config.oauthProviders) ids.add(`oauth-${provider}`);
  ids.add(`rbac-${config.rbac}`);
  ids.add(`frontend-${config.frontend.kind}`);
  ids.add(`ui-${config.frontend.ui}`);
  if (config.frontend.ui === 'shadcn') ids.add('ui-tailwind');
  ids.add(`state-${config.frontend.state}`);
  ids.add(`query-${config.frontend.serverState}`);
  ids.add(`forms-${config.frontend.forms}`);
  ids.add(`validation-${config.validation}`);
  ids.add(`client-${config.frontend.apiClient}`);
  ids.add(`cache-${config.cache}`);
  ids.add(`queue-${config.queue}`);
  ids.add(`storage-${config.storage}`);
  ids.add(`email-${config.email}`);
  for (const channel of config.notifications) ids.add(`notify-${channel}`);
  for (const payment of config.payments) ids.add(`pay-${payment}`);
  ids.add(`ws-${config.websockets}`);
  ids.add(`search-${config.search}`);
  ids.add(`log-${config.logging}`);
  for (const item of config.monitoring) ids.add(`mon-${item}`);
  ids.add(`test-${config.testing.unit}`);
  if (config.testing.e2e !== 'none') ids.add(`e2e-${config.testing.e2e}`);
  if (config.docker !== 'none') ids.add(`docker-${config.docker === 'dev+prod' ? 'prod' : 'dev'}`);
  if (config.docker === 'dev+prod') ids.add('docker-dev');
  if (config.cicd !== 'none') ids.add(`cicd-${config.cicd}`);
  ids.add(`admin-${config.admin}`);
  ids.add(`tenant-${config.multiTenancy}`);
  ids.add(`openapi-${config.openapi}`);
  if (config.openapi === 'swagger' || config.openapi === 'openapi+client') {
    ids.add('openapi-openapi');
  }
  ids.add(`arch-${config.architecture}`);
  if (config.cqrs !== 'none') ids.add(`cqrs-${config.cqrs}`);
  if (config.auditLog) ids.add('audit-log');
  if (config.mailpit) ids.add('mailpit');
  if (config.events !== 'none') ids.add(`events-${config.events}`);

  return [...ids].filter((id) => !id.endsWith('-none') && !id.endsWith('-disabled'));
}

export function applyFeatureToConfig(config: StarterConfig, featureId: string): StarterConfig {
  const next = structuredClone(config);
  const set = new Set(next.features);
  set.add(featureId);
  next.features = [...set];

  const [group, value] = splitFeature(featureId);

  switch (group) {
    case 'orm':
      next.orm = value as StarterConfig['orm'];
      break;
    case 'auth':
      next.auth = value as StarterConfig['auth'];
      break;
    case 'rbac':
      next.rbac = value as StarterConfig['rbac'];
      break;
    case 'cache':
      next.cache = value as StarterConfig['cache'];
      break;
    case 'queue':
      next.queue = value as StarterConfig['queue'];
      break;
    case 'storage':
      next.storage = value as StarterConfig['storage'];
      break;
    case 'email':
      next.email = value as StarterConfig['email'];
      break;
    case 'ws':
      next.websockets = value as StarterConfig['websockets'];
      break;
    case 'search':
      next.search = value as StarterConfig['search'];
      break;
    case 'pay':
      if (!next.payments.includes(value as StarterConfig['payments'][number])) {
        next.payments.push(value as StarterConfig['payments'][number]);
      }
      break;
    case 'oauth':
      if (!next.oauthProviders.includes(value as StarterConfig['oauthProviders'][number])) {
        next.oauthProviders.push(value as StarterConfig['oauthProviders'][number]);
      }
      break;
    case 'docker':
      next.docker = value === 'prod' ? 'dev+prod' : 'dev';
      break;
    case 'redis':
      next.cache = 'redis';
      break;
    case 'audit':
      next.auditLog = true;
      break;
    default:
      break;
  }

  return next;
}

export function removeFeatureFromConfig(config: StarterConfig, featureId: string): StarterConfig {
  const next = structuredClone(config);
  next.features = next.features.filter((id) => id !== featureId);
  const [group, value] = splitFeature(featureId);

  switch (group) {
    case 'cache':
      if (value === 'redis') next.cache = 'none';
      break;
    case 'queue':
      next.queue = 'none';
      break;
    case 'pay':
      next.payments = next.payments.filter((item) => item !== value);
      break;
    case 'oauth':
      next.oauthProviders = next.oauthProviders.filter((item) => item !== value);
      break;
    case 'auth':
      next.auth = 'none';
      break;
    case 'rbac':
      next.rbac = 'none';
      break;
    case 'docker':
      next.docker = 'none';
      break;
    case 'audit':
      next.auditLog = false;
      break;
    default:
      break;
  }

  return next;
}

function splitFeature(id: string): [string, string] {
  const idx = id.indexOf('-');
  if (idx === -1) return [id, id];
  return [id.slice(0, idx), id.slice(idx + 1)];
}
