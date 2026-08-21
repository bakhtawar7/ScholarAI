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
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
