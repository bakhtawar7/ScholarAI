/// <reference types="vite/client" />

/**
 * Typed build-time environment variables.
 *
 * The tsconfig does not include "vite/client" in `types`, so without this file
 * `import.meta.env` is an unknown property and `tsc` fails the production build.
 */
interface ImportMetaEnv {
  /** Absolute base URL of the backend API, e.g. https://api.example.com/api.
   *  Leave unset to use the relative '/api' path (dev proxy or same-origin deploy). */
  readonly VITE_API_URL?: string;
  /** Browser Sentry DSN. Unset leaves error reporting disabled and makes no outbound calls. */
  readonly VITE_SENTRY_DSN?: string;
  /** Sentry environment label. Falls back to MODE. */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** Sentry release. Defaults to scholarai-frontend@$VITE_APP_VERSION. */
  readonly VITE_SENTRY_RELEASE?: string;
  /** Share of transactions traced, 0–1. 0 (the default) disables tracing. */
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
  /** Version stamped onto the Sentry release. */
  readonly VITE_APP_VERSION?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
