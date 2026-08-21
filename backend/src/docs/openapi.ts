import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config';
import { parameters, responses, schemas, securitySchemes } from './components';
import { systemPaths } from './paths/system';
import { authPaths, profilePaths } from './paths/auth';
import { recommendationPaths, savedPaths, scholarshipPaths } from './paths/scholarships';
import { applicationPaths, deadlinePaths, notificationPaths } from './paths/applications';
import { documentPaths } from './paths/documents';
import { chatPaths } from './paths/chat';
import { automationPaths } from './paths/automation';

/**
 * The ScholarAI OpenAPI document.
 *
 * Paths are declared as plain objects rather than scanned out of JSDoc comments, so the
 * spec is identical under ts-node and the compiled `dist/` build and does not depend on
 * source files being shipped or on comments surviving compilation. `apis: []` keeps
 * swagger-jsdoc as the assembler/validator, and annotated files can be added later
 * without changing anything here.
 *
 * Only routes that actually exist are documented — see `src/routes/` for the mounting.
 */

const DESCRIPTION = [
  'API documentation for ScholarAI, an AI-powered scholarship discovery and application assistant.',
  '',
  '### Authentication',
  '',
  'All endpoints except registration, login, the health probes and public scholarship browsing',
  'require a JWT bearer token. Obtain one from `POST /api/auth/register` or `POST /api/auth/login`,',
  'then click **Authorize** above and paste the token.',
  '',
  'Scholarship search, single-scholarship reads and eligibility checks accept an *optional* token:',
  'anonymous callers get the catalogue data, authenticated callers additionally get `userMatch`,',
  '`isSaved` and `applicationStatus`.',
  '',
  'Routes marked **(admin)** require an account whose JWT role is `ADMIN` or whose email is listed',
  'in the `ADMIN_EMAILS` environment variable.',
  '',
  '### Errors',
  '',
  'Every error is JSON with an `error` string. Validation failures (400) add a `details` array of',
  '`{ field, message }`. Rejected tokens (401) add `code`: `TOKEN_EXPIRED` or `TOKEN_INVALID`.',
  'Server errors (500) return a deliberately generic message — the detail goes to the logs and',
  'to Sentry, never to the client.',
  '',
  '### Rate limiting',
  '',
  'All `/api` traffic passes a global limiter. Credential, chat and AI-heavy routes have tighter',
  'per-bucket limits. A 429 carries `Retry-After`, `X-RateLimit-Limit` and `X-RateLimit-Remaining`.',
  '',
  '### Advisory scoring',
  '',
  'Match scores and eligibility assessments are AI estimates for discovery and planning only.',
  'They are never an official eligibility decision — requirements must be confirmed with the',
  'awarding institution.',
].join('\n');

const TAGS = [
  { name: 'Auth', description: 'Registration, login and the current session.' },
  { name: 'Profile', description: 'The student academic profile that drives matching.' },
  { name: 'Scholarships', description: 'Catalogue search, retrieval and administration.' },
  { name: 'Recommendations', description: 'Personalised ranked matches.' },
  { name: 'Eligibility', description: 'Per-scholarship compatibility assessment.' },
  { name: 'Saved', description: 'Bookmarked scholarships.' },
  { name: 'Applications', description: 'Application tracker and document checklists.' },
  { name: 'Deadlines', description: 'Deadline views and the milestone reminder sweep.' },
  { name: 'Notifications', description: 'In-app notification feed.' },
  { name: 'CV', description: 'CV upload and nine-dimension analysis.' },
  { name: 'SOP', description: 'Statement of purpose guidance, evaluation and drafts.' },
  { name: 'Chatbot', description: 'Conversational assistant backed by the orchestrator agent.' },
  { name: 'Verification', description: 'Scholarship verification queue and audit trail (admin).' },
  { name: 'Automation', description: 'Background workflow console (admin).' },
  { name: 'System', description: 'Liveness and readiness probes.' },
];

export function buildOpenApiSpec(): Record<string, any> {
  return swaggerJsdoc({
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'ScholarAI API',
        version: config.appVersion,
        description: DESCRIPTION,
      },
      servers: [
        { url: '/', description: 'This server' },
        { url: 'http://localhost:5000', description: 'Local development' },
      ],
      tags: TAGS,
      // Applied to every operation unless it declares its own `security`.
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes,
        schemas,
        parameters,
        responses,
      },
      paths: {
        ...systemPaths,
        ...authPaths,
        ...profilePaths,
        ...scholarshipPaths,
        ...recommendationPaths,
        ...savedPaths,
        ...applicationPaths,
        ...deadlinePaths,
        ...notificationPaths,
        ...documentPaths,
        ...chatPaths,
        ...automationPaths,
      },
    },
    apis: [],
  }) as Record<string, any>;
}
