/** Application tracker, deadline views and in-app notifications. */

export const applicationPaths = {
  '/api/applications': {
    get: {
      tags: ['Applications'],
      summary: "List the caller's applications",
      description: 'Each application carries its scholarship and checklist items.',
      responses: {
        200: {
          description: 'Applications.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Application' } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    post: {
      tags: ['Applications'],
      summary: 'Start tracking an application',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApplicationCreateRequest' } } },
      },
      responses: {
        201: {
          description: 'Created.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Application' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        409: { $ref: '#/components/responses/Conflict' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/applications/{id}': {
    patch: {
      tags: ['Applications'],
      summary: 'Update an application',
      description: 'Partial update of status, notes and submission date. At least one field is required.',
      parameters: [{ $ref: '#/components/parameters/ApplicationId' }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApplicationUpdateRequest' } } },
      },
      responses: {
        200: {
          description: 'Updated.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Application' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    delete: {
      tags: ['Applications'],
      summary: 'Delete an application',
      description: 'Also removes its checklist items.',
      parameters: [{ $ref: '#/components/parameters/ApplicationId' }],
      responses: {
        200: {
          description: 'Deleted.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/applications/{id}/status': {
    patch: {
      tags: ['Applications'],
      summary: 'Change application status',
      description: [
        'Moving to `APPLIED` stamps `submissionDate` if it is not already set.',
        '',
        'When the status actually changes, ScholarAI emails the applicant an "application',
        'update" notice. The email is fire-and-forget: a mail failure is logged and reported',
        'to Sentry but never fails this request.',
      ].join('\n'),
      parameters: [{ $ref: '#/components/parameters/ApplicationId' }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApplicationStatusRequest' } } },
      },
      responses: {
        200: {
          description: 'Updated.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Application' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/applications/{id}/checklist': {
    post: {
      tags: ['Applications'],
      summary: 'Add a checklist item',
      parameters: [{ $ref: '#/components/parameters/ApplicationId' }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ChecklistCreateRequest' } } },
      },
      responses: {
        201: {
          description: 'Created.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChecklistItem' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/applications/{id}/populate-template': {
    post: {
      tags: ['Applications'],
      summary: 'Populate the standard document checklist',
      description:
        "Seeds the application with the scholarship's required documents as checklist items. Existing items are preserved.",
      parameters: [{ $ref: '#/components/parameters/ApplicationId' }],
      responses: {
        200: {
          description: 'Checklist populated.',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/applications/checklist/{checklistId}': {
    patch: {
      tags: ['Applications'],
      summary: 'Toggle a checklist item',
      description:
        'Flips `isCompleted`. Declared before `/{id}` in the router so `checklist` is never captured as an application id.',
      parameters: [{ $ref: '#/components/parameters/ChecklistId' }],
      responses: {
        200: {
          description: 'Toggled.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChecklistItem' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    delete: {
      tags: ['Applications'],
      summary: 'Delete a checklist item',
      parameters: [{ $ref: '#/components/parameters/ChecklistId' }],
      responses: {
        200: {
          description: 'Deleted.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },
} as const;

export const deadlinePaths = {
  '/api/deadlines': {
    get: {
      tags: ['Deadlines'],
      summary: 'Upcoming deadlines for saved and tracked scholarships',
      description:
        'Merges saved bookmarks and tracked applications, keeps entries that have a deadline, and sorts by days remaining (expired first).',
      responses: {
        200: {
          description: 'Deadlines with urgency banding.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Deadline' } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/deadlines/run-automation': {
    post: {
      tags: ['Deadlines'],
      summary: 'Run the deadline reminder sweep (admin)',
      description: [
        "Admin-only: this sweeps **every** user's saved and tracked scholarships and writes",
        'notifications for all of them.',
        '',
        'Reminders fire at the 30/14/7/3/1-day milestones and are deduplicated by a unique',
        'key, so overlapping runs cannot double-notify. Notifications for already-submitted',
        'or rejected applications are suppressed.',
      ].join('\n'),
      parameters: [
        {
          name: 'force',
          in: 'query',
          schema: { type: 'boolean' },
          description:
            'Fold deadlines beyond the widest milestone into the 30-day bucket so a manual run produces output. Can also be sent as `{ "force": true }` in the body.',
        },
      ],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: { type: 'object', properties: { force: { type: 'boolean' } } },
          },
        },
      },
      responses: {
        200: {
          description: 'Sweep report.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DeadlineAutomationResult' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },
} as const;

export const notificationPaths = {
  '/api/notifications': {
    get: {
      tags: ['Notifications'],
      summary: 'List notifications',
      parameters: [
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          description: 'Clamped to 1–100.',
        },
        {
          name: 'unreadOnly',
          in: 'query',
          schema: { type: 'string', enum: ['true', 'false'] },
          description: 'Send `true` to return unread notifications only.',
        },
      ],
      responses: {
        200: {
          description: 'Notifications, newest first.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/notifications/unread-count': {
    get: {
      tags: ['Notifications'],
      summary: 'Unread notification count',
      responses: {
        200: {
          description: 'Count of unread notifications.',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { count: { type: 'integer', example: 3 } } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/notifications/{id}/read': {
    patch: {
      tags: ['Notifications'],
      summary: 'Mark one notification read',
      description:
        "The write is scoped to the owner, so another user's notification cannot be marked read by guessing an id.",
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        200: {
          description: 'Marked read.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/notifications/read-all': {
    patch: {
      tags: ['Notifications'],
      summary: 'Mark all notifications read',
      responses: {
        200: {
          description: 'How many rows were updated.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { success: { type: 'boolean' }, updated: { type: 'integer' } },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },
} as const;
