/**
 * CV analysis and SOP assistance.
 *
 * Document text is the most sensitive payload the API accepts. It is never sent to
 * Sentry, and raw CV text is purged after `CV_RETENTION_DAYS` while the derived
 * analysis is retained.
 */
export const documentPaths = {
  '/api/documents/cv/analyze': {
    post: {
      tags: ['CV'],
      summary: 'Analyse a CV',
      description: [
        'Accepts either a file upload or raw text and returns a nine-dimension evaluation.',
        '',
        '- Upload a single file in the `file` field: PDF, DOCX, DOC or TXT, at most 5MB.',
        '- Or post `{ "text": "…" }` as JSON. At least 30 characters of content are required.',
        '',
        'Rate limited as an AI-heavy route (`RATE_LIMIT_AI_MAX`, 12 per window by default).',
      ].join('\n'),
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary', description: 'PDF, DOCX, DOC or TXT, max 5MB.' },
              },
            },
          },
          'application/json': {
            schema: {
              type: 'object',
              required: ['text'],
              properties: { text: { type: 'string', minLength: 30, description: 'Raw CV text.' } },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Analysis result.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CVAnalysis' } } },
        },
        400: {
          description: 'Unsupported format, unreadable document, or content shorter than 30 characters.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        413: {
          description: 'File exceeds the 5MB upload limit.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/cv/latest': {
    get: {
      tags: ['CV'],
      summary: 'Latest CV analysis',
      responses: {
        200: {
          description: 'The most recent analysis, or `null` when none exists.',
          content: {
            'application/json': {
              schema: { allOf: [{ $ref: '#/components/schemas/CVAnalysis' }], nullable: true },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/cv/history': {
    get: {
      tags: ['CV'],
      summary: 'CV analysis history',
      description: 'Raw document text older than the retention window is redacted; the derived analysis remains.',
      responses: {
        200: {
          description: 'Past analyses, newest first.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/CVAnalysis' } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/cv/{id}': {
    delete: {
      tags: ['CV'],
      summary: 'Delete a CV analysis',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        200: {
          description: 'Deleted.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/cv/sync-profile': {
    post: {
      tags: ['CV'],
      summary: 'Copy extracted skills into the profile',
      description: 'Merges CV-extracted skills (and optionally a research summary) into the student profile.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/CVSyncRequest' } } },
      },
      responses: {
        200: {
          description: 'Profile updated.',
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
        },
        400: {
          description: '`skills` was not an array.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/sop/questions': {
    get: {
      tags: ['SOP'],
      summary: 'Guided SOP questions',
      description: 'Returns the question set that seeds an outline, tailored to the caller\'s profile.',
      parameters: [
        { name: 'targetScholarshipTitle', in: 'query', schema: { type: 'string' } },
        { name: 'fieldOfStudy', in: 'query', schema: { type: 'string' } },
      ],
      responses: {
        200: {
          description: 'Question set.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPQuestionSet' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/sop/outline': {
    post: {
      tags: ['SOP'],
      summary: 'Build a structured SOP outline',
      description: 'Turns answers from the guided questions into a paragraph-by-paragraph plan.',
      requestBody: {
        required: false,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPOutlineRequest' } } },
      },
      responses: {
        200: {
          description: 'Outline.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPOutline' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/sop/analyze': {
    post: {
      tags: ['SOP'],
      summary: 'Evaluate an SOP draft',
      description: [
        'Scores alignment, structure, clarity and relevance, and persists the draft as a',
        'session. At least 30 characters of draft content are required.',
        '',
        'Anti-hallucination guarded: feedback never invents credentials the draft does not',
        'contain. Rate limited as an AI-heavy route.',
      ].join('\n'),
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPAnalyzeRequest' } } },
      },
      responses: {
        200: {
          description: 'Saved session including its feedback.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPSession' } } },
        },
        400: {
          description: 'Draft shorter than 30 characters.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/sop/refine': {
    post: {
      tags: ['SOP'],
      summary: 'Refine one SOP section',
      description: 'Rewrites a single section for clarity and academic tone without inventing facts. Rate limited as an AI-heavy route.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPRefineRequest' } } },
      },
      responses: {
        200: {
          description: 'Refined text plus an explanation of what changed.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPRefineResponse' } } },
        },
        400: {
          description: '`originalText` was missing or empty.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/sop/sessions': {
    get: {
      tags: ['SOP'],
      summary: 'List SOP sessions',
      responses: {
        200: {
          description: 'The caller\'s saved drafts.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/SOPSession' } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    post: {
      tags: ['SOP'],
      summary: 'Save or update an SOP draft',
      description: 'Supply `sessionId` to update an existing draft, or omit it to create a new one.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPSaveSessionRequest' } } },
      },
      responses: {
        200: {
          description: 'Saved session.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPSession' } } },
        },
        400: {
          description: '`draftText` was missing.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/documents/sop/sessions/{id}': {
    get: {
      tags: ['SOP'],
      summary: 'Get one SOP session',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        200: {
          description: 'The session.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SOPSession' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    delete: {
      tags: ['SOP'],
      summary: 'Delete an SOP session',
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      responses: {
        200: {
          description: 'Deleted.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },
} as const;
