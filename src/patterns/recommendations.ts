import type { PatternRecommendation, StarterConfig } from '../core/types.js';

export function recommendPatterns(config: StarterConfig): PatternRecommendation[] {
  const recommendations: PatternRecommendation[] = [];

  if (config.payments.length > 1) {
    recommendations.push(
      {
        pattern: 'strategy',
        reason: 'Multiple payment providers share one payment contract.',
      },
      {
        pattern: 'adapter',
        reason: 'Each gateway should adapt to a common PaymentGateway port.',
      },
      {
        pattern: 'factory',
        reason: 'A factory can resolve the correct gateway from configuration.',
      },
    );
  } else if (config.payments.length === 1) {
    recommendations.push({
      pattern: 'adapter',
      reason: 'A payment adapter keeps domain code independent of the provider SDK.',
    });
  }

  if (
    ['s3', 'r2', 'minio'].includes(config.storage) ||
    (config.storage !== 'none' && config.storage !== 'local')
  ) {
    recommendations.push({
      pattern: 'adapter',
      reason: 'Storage providers should implement a shared StorageProvider port.',
    });
  }

  if (config.email !== 'none') {
    recommendations.push({
      pattern: 'adapter',
      reason: 'Email providers should implement a shared EmailProvider port.',
    });
  }

  if (config.search !== 'none') {
    recommendations.push({
      pattern: 'strategy',
      reason: 'Search backends can be swapped behind one SearchProvider.',
    });
  }

  if (config.architecture === 'ddd' || config.architecture === 'clean') {
    recommendations.push(
      { pattern: 'repository', reason: 'Domain should depend on repository contracts, not the ORM.' },
      { pattern: 'use-case', reason: 'Application use-cases keep controllers thin.' },
    );
  }

  if (config.events !== 'none') {
    recommendations.push({
      pattern: 'observer',
      reason: 'Domain events should be published to listeners without coupling modules.',
    });
  }

  if (config.designPatterns.includes('singleton')) {
    recommendations.push({
      pattern: 'singleton',
      reason:
        'Warning: Singleton is rarely needed in Node.js. Prefer dependency injection and module scope.',
    });
  }

  const seen = new Set<string>();
  return recommendations.filter((item) => {
    const key = `${item.pattern}:${item.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
