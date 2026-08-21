/** Chatbot conversations and the orchestrator agent. */
export const chatPaths = {
  '/api/chat/conversations': {
    get: {
      tags: ['Chatbot'],
      summary: 'List conversations',
      description: 'Newest first, capped at 100, each with its most recent message.',
      responses: {
        200: {
          description: 'Conversations.',
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: '#/components/schemas/ChatConversation' } },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    post: {
      tags: ['Chatbot'],
      summary: 'Create a conversation',
      description: 'Optional — posting a message to the literal id `new` creates one implicitly.',
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string', minLength: 1, maxLength: 120, default: 'Scholarship Assistant Session' },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Created.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatConversation' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/chat/conversations/{conversationId}': {
    get: {
      tags: ['Chatbot'],
      summary: 'Get a conversation with its messages',
      description: 'Messages are returned oldest first, capped at 500.',
      parameters: [{ $ref: '#/components/parameters/ConversationId' }],
      responses: {
        200: {
          description: 'The conversation.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatConversation' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    patch: {
      tags: ['Chatbot'],
      summary: 'Rename a conversation',
      parameters: [
        {
          name: 'conversationId',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['title'],
              properties: { title: { type: 'string', minLength: 1, maxLength: 120 } },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Renamed.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatConversation' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },

    delete: {
      tags: ['Chatbot'],
      summary: 'Delete a conversation',
      description: 'Also removes its messages.',
      parameters: [{ $ref: '#/components/parameters/ConversationId' }],
      responses: {
        200: {
          description: 'Deleted.',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { message: { type: 'string' } } },
            },
          },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },

  '/api/chat/conversations/{conversationId}/messages': {
    post: {
      tags: ['Chatbot'],
      summary: 'Send a message to the assistant',
      description: [
        'Runs the orchestrator agent, which can call internal tools (profile lookup,',
        'scholarship search, eligibility checks) before replying.',
        '',
        'Pass the literal `new` as `conversationId` to create the conversation with this first',
        'message; the real id comes back in the response.',
        '',
        'Rate limited (`RATE_LIMIT_CHAT_MAX`, 20 per window by default) because one message',
        'can fan out into several model round-trips. Without an LLM key configured, the',
        'deterministic reasoning engine answers instead.',
      ].join('\n'),
      parameters: [{ $ref: '#/components/parameters/ConversationId' }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMessageRequest' } } },
      },
      responses: {
        200: {
          description: 'Assistant reply.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMessageResponse' } } },
        },
        400: { $ref: '#/components/responses/ValidationFailed' },
        401: { $ref: '#/components/responses/Unauthorized' },
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  },
} as const;
