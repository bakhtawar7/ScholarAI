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
      description: [
        'Returns the authenticated account with its parsed student profile.',
        '',
        'Includes a computed `isAdmin` flag. Clients must read that rather than comparing',
        '`role` themselves: administrator access can also be granted through `ADMIN_EMAILS`,',
        'which the role field does not reflect.',
      ].join('\n'),
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

  '/api/auth/forgot-password': {
    post: {
      tags: ['Auth'],
      summary: 'Request a password reset link',
      description: [
        'Emails a single-use reset link to the address, if an account exists for it.',
        '',
        '**Always answers 200 with the same body**, whether or not the address is registered.',
        'A different status or message would make this endpoint an account-enumeration oracle.',
        '',
        'Only a SHA-256 hash of the token is stored, so a database leak cannot be replayed to',
        'seize accounts. Links expire after `PASSWORD_RESET_TTL_MINUTES` (60 by default).',
        '',
        'Two independent limits apply: IP rate limiting (`RATE_LIMIT_RESET_MAX`, 5 per 15',
        'minutes) bounds one source, and a per-account cap of 3 live links per 15 minutes',
        'bounds one target — so this cannot be used to mail-bomb a known address.',
      ].join('\n'),
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email'],
              properties: { email: { type: 'string', format: 'email', example: 'student@example.com' } },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Request accepted. Identical whether or not the account exists.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'If an account exists for that address, a password reset link is on its way.',
                  },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/auth/reset-password': {
    post: {
      tags: ['Auth'],
      summary: 'Complete a password reset',
      description: [
        'Consumes the emailed token and sets a new password.',
        '',
        'The token is single-use, and any other outstanding link for the account is voided.',
        "Success also advances the account's revocation point, so **every existing session is",
        'signed out** — a reset that left old tokens valid would not recover a compromised',
        'account.',
        '',
        'Invalid, expired and already-used tokens all return the same 400 message, so a caller',
        'cannot probe which tokens exist.',
      ].join('\n'),
      security: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['token', 'password'],
              properties: {
                token: { type: 'string', description: 'The token from the emailed link.' },
                password: {
                  type: 'string',
                  minLength: 10,
                  description: 'At least 10 characters with a lowercase letter, an uppercase letter and a number.',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Password reset.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    example: 'Your password has been reset. Please sign in with your new password.',
                  },
                },
              },
            },
          },
        },
        400: {
          description: 'The link is invalid, expired or already used, or the password fails policy.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/auth/change-password': {
    post: {
      tags: ['Auth'],
      summary: 'Change your password',
      description: [
        "Changes the signed-in account's password.",
        '',
        'The current password is required even though the caller is already authenticated: a',
        'stolen token alone must not be enough to take permanent ownership of an account.',
        '',
        'All other sessions are signed out. A **new token is returned** because the change',
        'invalidates the one the request was made with — clients must store it.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['currentPassword', 'newPassword'],
              properties: {
                currentPassword: { type: 'string' },
                newPassword: {
                  type: 'string',
                  minLength: 10,
                  description: 'Must differ from the current password.',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Password changed. Replace the stored token with the one returned here.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  token: { type: 'string', description: 'Replacement JWT.' },
                },
              },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: {
          description: 'Not signed in, or the current password is incorrect.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/auth/logout-all': {
    post: {
      tags: ['Auth'],
      summary: 'Sign out on all devices',
      description: [
        'Revokes every session for the account by advancing its revocation point. The token',
        'used to make this call is invalidated too.',
        '',
        'A plain sign-out is client-side only — it discards the stored token while the token',
        'itself stays valid until it expires. This is the server-side counterpart, for a user',
        'who believes a device was compromised.',
      ].join('\n'),
      responses: {
        200: {
          description: 'All sessions revoked.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { message: { type: 'string', example: 'You have been signed out on all devices.' } },
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

const profileUpdateOperation = {
  tags: ['Profile'],
  summary: 'Update the student profile',
  description: [
    "Full-or-partial upsert of the signed-in user's profile. `POST`, `PUT` and `PATCH` are",
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
          description: "The signed-in user's profile.",
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
