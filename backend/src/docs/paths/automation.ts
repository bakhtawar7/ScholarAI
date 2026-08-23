/**
 * Automation console. Every route here requires an administrator account: a manual
 * trigger can start a catalogue-wide recalculation or a platform-wide notification sweep.
 */
export const automationPaths = {
  '/api/automation/workflows': {
    get: {
      tags: ['Automation'],
      summary: 'Workflow catalogue and scheduler state (admin)',
      responses: {
        200: {
          description: "Registered workflows with each one's last run.",
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  schedulerRunning: { type: 'boolean' },
                  currentlyRunning: { type: 'array', items: { type: 'string' } },
                  total: { type: 'integer' },
                  workflows: { type: 'array', items: { $ref: '#/components/schemas/WorkflowSummary' } },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/automation/stats': {
    get: {
      tags: ['Automation'],
      summary: 'Aggregate automation health (admin)',
      responses: {
        200: {
          description: 'Run counts over the last 24 hours plus scheduler state.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AutomationStats' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/automation/runs': {
    get: {
      tags: ['Automation'],
      summary: 'Workflow execution history (admin)',
      parameters: [
        {
          name: 'workflowKey',
          in: 'query',
          schema: { type: 'string', maxLength: 64 },
          description: 'Filter to one workflow.',
        },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED'] },
        },
        { $ref: '#/components/parameters/Page' },
        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
      ],
      responses: {
        200: {
          description: 'Paginated run history, newest first.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  totalPages: { type: 'integer' },
                  items: { type: 'array', items: { $ref: '#/components/schemas/WorkflowRun' } },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/automation/runs/{id}': {
    get: {
      tags: ['Automation'],
      summary: 'Get one workflow run (admin)',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: {
          description: 'The run record.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/WorkflowRun' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/automation/workflows/{key}/run': {
    post: {
      tags: ['Automation'],
      summary: 'Run a workflow now (admin)',
      description: [
        'Runs the workflow synchronously so the caller sees the real outcome. The HTTP status',
        'reflects the run: `200` on success, `409` when an overlapping run blocked it, `500`',
        'when the run itself failed.',
        '',
        'Rate limited to 10 manual triggers per minute — these are the expensive path.',
      ].join('\n'),
      parameters: [
        {
          name: 'key',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Workflow key, e.g. `deadline-reminder` or `notification-dispatch`.',
        },
      ],
      requestBody: {
        required: false,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/TriggerWorkflowRequest' } } },
      },
      responses: {
        200: {
          description: 'Run completed successfully.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  workflow: {
                    type: 'object',
                    properties: { key: { type: 'string' }, name: { type: 'string' } },
                  },
                  runId: { type: 'string', format: 'uuid' },
                  workflowKey: { type: 'string' },
                  status: { type: 'string', enum: ['SUCCESS', 'FAILED', 'SKIPPED'] },
                  attempts: { type: 'integer' },
                  durationMs: { type: 'integer' },
                  metrics: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: {
          description: 'Unknown workflow key. The response lists the available keys.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  availableWorkflows: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        409: {
          description: 'Skipped — an overlapping run of this workflow is already in flight.',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: {
          description: 'The workflow ran and failed. The body carries the run record and error.',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
      },
    },
  },
} as const;
