/** Authentication and the authenticated user's academic profile. */
export const authPaths = {
  '/api/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Create an account',
      description: [
        'Creates a user and an initial student profile, then returns a JWT.',
        '',
        'A ScholarAI welcome email is dispatched fire-and-forget — registration succeeds even',
        'if the mail provider is unavailable.',
        '',
        'IP rate limited (`RATE_LIMIT_AUTH_MAX`, 20 per window by default).',
      ].join('\n'),
      security: [],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
      },
      responses: {
        201: {
          description: 'Account created.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        409: {
          description: 'An account with this email already exists.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Sign in',
      description:
        'Returns a JWT on success. The response is deliberately identical for an unknown email and a wrong password, and timing is equalised, so neither reveals whether an account exists.',
      security: [],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
      },
      responses: {
        200: {
          description: 'Authenticated.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: {
          description: 'Invalid email or password.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Current user',
      description: 'Returns the authenticated account with its parsed student profile.',
      responses: {
        200: {
          description: 'The signed-in user.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CurrentUser' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },
} as const;

const profileUpdateOperation = {
  tags: ['Profile'],
  summary: 'Update the student profile',
  description: [
    'Full-or-partial upsert of the signed-in user\'s profile. `POST`, `PUT` and `PATCH` are',
    'accepted interchangeably for client compatibility and behave identically.',
    '',
    'Unknown keys are stripped, so `role` and `isVerified` cannot be set from here.',
    'Saving a profile triggers a background match recalculation.',
  ].join('\n'),
  requestBody: {
    required: true,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileUpdateRequest' } } },
  },
  responses: {
    200: {
      description: 'Updated profile.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/StudentProfile' } } },
    },
    400: { $ref: '#/components/responses/ValidationFailed' },
    401: { $ref: '#/components/responses/Unauthorized' },
    500: { $ref: '#/components/responses/ServerError' },
  },
} as const;

export const profilePaths = {
  '/api/profile': {
    get: {
      tags: ['Profile'],
      summary: 'Get the student profile',
      responses: {
        200: {
          description: 'The signed-in user\'s profile.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/StudentProfile' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
    post: profileUpdateOperation,
    put: profileUpdateOperation,
    patch: profileUpdateOperation,
  },
} as const;
