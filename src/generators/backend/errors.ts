import type {
  GenerationContextLike,
  Generator,
  StarterConfig,
  ValidationResult,
} from '../../core/types.js';
import { emptyValidation } from '../../core/types.js';
import { ctxPaths } from '../helpers.js';
import {
  httpTypes,
  interfaceBlock,
  isExpress,
  isFastify,
  isTs,
  params,
  relImport,
  ret,
  t,
  writeSrc,
} from './shared.js';

export class ErrorsGenerator implements Generator {
  id() {
    return 'backend-errors';
  }

  supports(_config: StarterConfig) {
    return true;
  }

  validate(_config: StarterConfig): ValidationResult {
    return emptyValidation();
  }

  async generate(context: GenerationContextLike): Promise<void> {
    const p = ctxPaths(context);
    const c = context.config;
    const errorsFile = p.apiFile('errors', 'index');
    const handlerFile = p.apiFile('middleware', 'error-handler');
    const notFoundFile = p.apiFile('middleware', 'not-found');
    const loggerFile = p.apiFile('lib', 'logger');
    const envFile = p.apiFile('config', 'env');
    const responseFile = p.apiFile('utils', 'api-response');
    const appFile = p.apiSrc(isTs(c) ? 'app.ts' : 'app.js');

    writeSrc(context, errorsFile, errorClasses(c));
    writeSrc(
      context,
      handlerFile,
      errorHandlerSource(c, {
        errors: relImport(handlerFile, errorsFile),
        logger: relImport(handlerFile, loggerFile),
        env: relImport(handlerFile, envFile),
        response: relImport(handlerFile, responseFile),
      }),
    );
    writeSrc(
      context,
      notFoundFile,
      notFoundSource(c, {
        errors: relImport(notFoundFile, errorsFile),
      }),
    );

    context.addMiddleware({
      name: 'not-found',
      importStatement: `import { notFoundHandler } from '${relImport(appFile, notFoundFile)}';`,
      useStatement: isExpress(c)
        ? 'app.use(notFoundHandler);'
        : 'app.setNotFoundHandler(notFoundHandler);',
      order: 900,
    });
    context.addMiddleware({
      name: 'error-handler',
      importStatement: `import { errorHandler } from '${relImport(appFile, handlerFile)}';`,
      useStatement: isExpress(c)
        ? 'app.use(errorHandler);'
        : 'app.setErrorHandler(errorHandler);',
      order: 1000,
    });
  }
}

function errorClasses(c: StarterConfig): string {
  return `${interfaceBlock(
    c,
    `export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';
`,
  )}export class AppError extends Error {
  ${t(c, 'readonly statusCode: number;\n  readonly code: string;\n  readonly details?: unknown;\n  readonly isOperational = true;\n', '')}
  constructor(message${t(c, ': string')}, statusCode = 500, code = 'INTERNAL_ERROR', details${t(c, '?: unknown')}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
${isTs(c) ? '' : '    this.isOperational = true;\n'}    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details${t(c, '?: unknown')}) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details${t(c, '?: unknown')}) {
    super(message, 401, 'UNAUTHENTICATED', details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details${t(c, '?: unknown')}) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details${t(c, '?: unknown')}) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', details${t(c, '?: unknown')}) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMITED');
  }
}

export class NotImplementedError extends AppError {
  constructor(message = 'Not implemented') {
    super(message, 501, 'INTERNAL_ERROR');
  }
}
`;
}

function errorHandlerSource(
  c: StarterConfig,
  imports: { errors: string; logger: string; env: string; response: string },
): string {
  const http = httpTypes(c);

  if (isFastify(c)) {
    return `${http.importLine}import { AppError } from '${imports.errors}';
import { logger } from '${imports.logger}';
import { env } from '${imports.env}';
import { fail } from '${imports.response}';

export function errorHandler(
  error${t(c, ': Error')},
  request${t(c, ': FastifyRequest')},
  reply${t(c, ': FastifyReply')},
) {
  const requestId = request.requestId;
  if (error instanceof AppError) {
    logger.warn({ err: { name: error.name, code: error.code, message: error.message }, requestId }, 'operational_error');
    return reply.status(error.statusCode).send(fail(error.code, error.message, error.details));
  }

  logger.error({ err: { name: error.name, message: error.message }, requestId }, 'unhandled_error');
  const expose = env.NODE_ENV !== 'production';
  return reply.status(500).send(
    fail('INTERNAL_ERROR', expose ? error.message : 'An unexpected error occurred'),
  );
}
`;
  }

  return `${http.importLine}import { AppError } from '${imports.errors}';
import { logger } from '${imports.logger}';
import { env } from '${imports.env}';
import { fail } from '${imports.response}';

export function errorHandler(
  ${params(c, [
    ['err', 'Error'],
    ['req', 'Request'],
    ['res', 'Response'],
    ['_next', 'NextFunction'],
  ])},
)${ret(c, 'void')} {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    logger.warn(
      { err: { name: err.name, code: err.code, message: err.message }, requestId },
      'operational_error',
    );
    res.status(err.statusCode).json(fail(err.code, err.message, err.details));
    return;
  }

  logger.error({ err: { name: err.name, message: err.message }, requestId }, 'unhandled_error');
  const expose = env.NODE_ENV !== 'production';
  res.status(500).json(fail('INTERNAL_ERROR', expose ? err.message : 'An unexpected error occurred'));
}
`;
}

function notFoundSource(c: StarterConfig, imports: { errors: string }): string {
  const http = httpTypes(c);

  if (isFastify(c)) {
    return `${http.importLine}import { AppError } from '${imports.errors}';

export function notFoundHandler(request${t(c, ': FastifyRequest')}, _reply${t(c, ': FastifyReply')}) {
  throw new AppError(\`Route \${request.method} \${request.url} not found\`, 404, 'NOT_FOUND');
}
`;
  }

  return `${http.importLine}import { AppError } from '${imports.errors}';

export function notFoundHandler(
  ${params(c, [
    ['req', 'Request'],
    ['_res', 'Response'],
    ['next', 'NextFunction'],
  ])},
)${ret(c, 'void')} {
  next(new AppError(\`Route \${req.method} \${req.originalUrl} not found\`, 404, 'NOT_FOUND'));
}
`;
}
