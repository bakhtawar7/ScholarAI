import type { Express, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from '../config';
import { logger } from '../utils/logger';
import { buildOpenApiSpec } from './openapi';

/**
 * Serves the ScholarAI API reference.
 *
 * - `GET /api/docs`      — Swagger UI
 * - `GET /api/docs.json` — the raw OpenAPI 3.0 document
 *
 * Set `API_DOCS_ENABLED=false` to serve neither, for a locked-down deployment.
 */

/**
 * The global `securityHeaders` middleware sends `default-src 'none'`, which is correct for
 * a JSON API but blocks Swagger UI from rendering at all — it is a real document that
 * loads its own bundle and inlines its initialiser. Relax the policy for this subtree
 * only: same-origin assets, plus inline script/style for the initialiser. The page
 * renders the spec and nothing else, so it carries no user data to protect.
 */
const docsCsp = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  next();
};

export function mountApiDocs(app: Express): void {
  if (!config.docsEnabled) {
    logger.info('API docs are disabled (API_DOCS_ENABLED=false)');
    return;
  }

  let spec: Record<string, any>;
  try {
    spec = buildOpenApiSpec();
  } catch (err: any) {
    // A malformed spec must never stop the API from booting.
    logger.error('Failed to build the OpenAPI spec — /api/docs will not be served', { message: err?.message });
    return;
  }

  // Machine-readable spec, for client generators and API test tooling.
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(spec));
  });

  app.use(
    '/api/docs',
    docsCsp,
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'ScholarAI API Reference',
      swaggerOptions: {
        // Keep the reference navigable: 15 tags collapsed by default, alphabetised
        // operations, and the authorisation token remembered across reloads.
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
        displayRequestDuration: true,
        filter: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
      },
    })
  );

  const pathCount = Object.keys(spec.paths || {}).length;
  logger.info(`API docs mounted at /api/docs (${pathCount} documented paths)`);
}
