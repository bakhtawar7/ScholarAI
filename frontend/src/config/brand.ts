/**
 * Product identity, in one place.
 *
 * The app previously shipped three names: "ScholarCopilot" in the landing-page logo and
 * the sidebar footer, "AI Scholarship Copilot" in the hero copy and chat headers, and
 * "ScholarAI" in every email. The landing page used two of them, and the sidebar used two
 * within the same component.
 *
 * "ScholarAI" wins because it is the name a person would say out loud, and it already
 * appears on everything the user receives by email. "AI Scholarship Copilot" was a
 * description, not a name, so it becomes the tagline.
 *
 * Keep this in sync with BRAND in backend/src/services/emailService.ts — that is the only
 * other place the name is written.
 */
export const APP_NAME = 'ScholarAI';

/** One line, sentence case, no superlatives. Used under the logo and in page subtitles. */
export const APP_TAGLINE = 'Scholarship discovery, eligibility analysis and application tracking';

/** Short form for tight spaces (sidebar, mobile header). */
export const APP_TAGLINE_SHORT = 'Scholarship discovery and tracking';
