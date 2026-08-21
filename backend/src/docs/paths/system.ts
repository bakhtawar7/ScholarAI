/** Liveness/readiness probes and the docs entry point itself. */
export const systemPaths = {
  '/api/health': {
    get: {
      tags: ['System'],
      summary: 'Liveness probe',
      description: 'Touches no dependencies, so it is safe for aggressive polling.',
      security: [],
      responses: {
        200: {
          description: 'The API process is running.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthStatus' } } },
        },
      },
    },
  },

  '/api/health/ready': {
    get: {
      tags: ['System'],
      summary: 'Readiness probe',
      description: 'Verifies the database is actually reachable with `SELECT 1`.',
      security: [],
      responses: {
        200: {
          description: 'Database reachable.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessStatus' } } },
        },
        503: {
          description: 'Database unreachable.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReadinessStatus' } } },
        },
      },
    },
  },
} as const;
