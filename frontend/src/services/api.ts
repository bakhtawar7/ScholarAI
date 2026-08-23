import {
  Scholarship,
  ScholarshipSearchResult,
  ScholarshipFilterFacets,
  ScholarshipMatch,
  PersonalisedScholarships,
  CountryDiscoveryResult,
} from '../types';
import { captureException } from '../utils/sentry';

/**
 * Base URL for the API.
 *
 * Reads VITE_API_URL so the built bundle can point at a separately-hosted backend.
 * Falls back to the relative '/api', which is what the Vite dev proxy and a
 * same-origin reverse proxy deployment both expect.
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '/api';

export class ApiError extends Error {
  status: number;
  details?: Array<{ field: string; message: string }>;

  constructor(message: string, status: number, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** True when the session is gone and the user needs to sign in again. */
  get isAuthError() {
    return this.status === 401;
  }

  get isRateLimited() {
    return this.status === 429;
  }
}

/** Notifies the app when the API rejects the stored token, so it can clear the session. */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Reports an API failure worth investigating.
 *
 * Deliberately narrow. A 401 is a normal expired session, a 400 is a form the user still
 * has to fix, and a 429 is the limiter working — forwarding those would bury real faults.
 * What is reported: server faults (5xx), and the transport failures (timeout, unreachable)
 * that indicate the API is down or the deployment's API URL is wrong.
 *
 * The endpoint and status go with the event; the request body never does, since it can
 * hold credentials, CV text or SOP drafts.
 */
function reportApiFailure(error: ApiError, endpoint: string, method: string) {
  const worthReporting = error.status >= 500 || error.status === 0 || error.status === 408;
  if (!worthReporting) return;

  captureException(error, {
    area: 'api',
    level: error.status >= 500 ? 'error' : 'warning',
    // Strip the query string: it can carry a search term or a scholarship id.
    extra: { endpoint: endpoint.split('?')[0], method, status: error.status },
  });
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) };
  const method = (options.method || 'GET').toUpperCase();

  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Let the browser set the multipart boundary for FormData bodies.
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  // Without a timeout a hung request leaves the UI spinning forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, signal: controller.signal });
  } catch (err: any) {
    clearTimeout(timeout);
    const apiError =
      err?.name === 'AbortError'
        ? new ApiError('The request timed out. Please check your connection and try again.', 408)
        : new ApiError('Cannot reach the server. Please check your connection and try again.', 0);
    reportApiFailure(apiError, endpoint, method);
    throw apiError;
  } finally {
    clearTimeout(timeout);
  }

  // 204 and empty bodies must not be parsed as JSON.
  const raw = await response.text();
  let data: any = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw.slice(0, 300) };
    }
  }

  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    const apiError = new ApiError(
      data.error || data.message || `Request failed (${response.status})`,
      response.status,
      data.details
    );
    reportApiFailure(apiError, endpoint, method);
    throw apiError;
  }

  return data as T;
}

function toQueryString(params: Record<string, any>): string {
  const clean: Record<string, string> = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== '') clean[key] = String(value);
  });
  return new URLSearchParams(clean).toString();
}

export const api = {
  // Auth
  register: (body: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request<any>('/auth/me'),

  // Password recovery & management
  /** Always resolves with the same generic message, whether or not the address exists. */
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  /** Returns a fresh token: changing the password invalidates the one in use. */
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string; token: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  logoutAll: () => request<{ message: string }>('/auth/logout-all', { method: 'POST' }),

  // Profile
  getProfile: () => request<any>('/profile'),
  updateProfile: (body: any) => request<any>('/profile', { method: 'POST', body: JSON.stringify(body) }),

  // Scholarships
  searchScholarships: (params: Record<string, any>) =>
    request<ScholarshipSearchResult>(`/scholarships?${toQueryString(params)}`),

  /** The personalised default view: grouped by home country, target countries, elsewhere. */
  getPersonalisedScholarships: (perSection?: number) =>
    request<PersonalisedScholarships>(`/scholarships/for-me${perSection ? `?perSection=${perSection}` : ''}`),

  /**
   * Runs a live search for one country on demand. Resolves even when every provider is
   * out of quota — check `usedLiveExternalSearch` rather than assuming success.
   */
  discoverScholarshipsForCountry: (body: { country: string; degreeLevel?: string; fieldOfStudy?: string }) =>
    request<CountryDiscoveryResult>('/scholarships/discover/country', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getScholarship: (id: string) => request<Scholarship>(`/scholarships/${id}`),
  getScholarshipFilters: () => request<ScholarshipFilterFacets>('/scholarships/filters'),

  // AI Matching & Eligibility Analysis
  getScholarshipEligibility: (id: string, options?: { forceRefresh?: boolean }) =>
    request<ScholarshipMatch>(`/scholarships/${id}/eligibility${options?.forceRefresh ? '?forceRefresh=true' : ''}`),
  evaluateCustomEligibility: (id: string, profile: any) =>
    request<ScholarshipMatch>(`/scholarships/${id}/eligibility/evaluate`, {
      method: 'POST',
      body: JSON.stringify({ profile }),
    }),
  recalculateMatches: () => request<any>('/scholarships/match/recalculate', { method: 'POST' }),

  // Verification Agent & Audit (admin only — these return 403 for student accounts)
  getVerificationAudit: (id: string) => request<any>(`/scholarships/${id}/verification`),
  triggerVerification: (id: string) => request<any>(`/scholarships/${id}/verify`, { method: 'POST' }),
  submitManualReview: (id: string, body: { status: string; notes: string }) =>
    request<any>(`/scholarships/${id}/manual-review`, { method: 'POST', body: JSON.stringify(body) }),
  getVerificationQueue: (params: Record<string, any> = {}) =>
    request<any>(`/scholarships/verification/queue?${toQueryString(params)}`),

  // Recommendations
  getRecommendations: () => request<any>('/recommendations'),

  // Saved
  getSaved: () => request<any>('/saved'),
  saveScholarship: (scholarshipId: string) => request<any>(`/saved/${scholarshipId}`, { method: 'POST' }),
  removeSaved: (scholarshipId: string) => request<any>(`/saved/${scholarshipId}`, { method: 'DELETE' }),

  // Applications
  getApplications: () => request<any>('/applications'),
  createApplication: (body: any) => request<any>('/applications', { method: 'POST', body: JSON.stringify(body) }),
  updateApplication: (id: string, body: any) =>
    request<any>(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteApplication: (id: string) => request<any>(`/applications/${id}`, { method: 'DELETE' }),
  updateApplicationStatus: (id: string, body: any) =>
    request<any>(`/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
  addChecklistItem: (id: string, body: any) =>
    request<any>(`/applications/${id}/checklist`, { method: 'POST', body: JSON.stringify(body) }),
  toggleChecklistItem: (checklistId: string) =>
    request<any>(`/applications/checklist/${checklistId}`, { method: 'PATCH' }),
  deleteChecklistItem: (checklistId: string) =>
    request<any>(`/applications/checklist/${checklistId}`, { method: 'DELETE' }),
  populateStandardChecklist: (id: string) => request<any>(`/applications/${id}/populate-template`, { method: 'POST' }),

  // Deadlines & Notifications
  getDeadlines: () => request<any>('/deadlines'),
  runDeadlineAutomation: (force?: boolean) =>
    request<any>(`/deadlines/run-automation${force ? '?force=true' : ''}`, { method: 'POST' }),
  getNotifications: () => request<any>('/notifications'),
  getUnreadNotificationCount: () => request<{ count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request<any>('/notifications/read-all', { method: 'PATCH' }),

  // Documents (CV & SOP)
  analyzeCV: (formData: FormData) => request<any>('/documents/cv/analyze', { method: 'POST', body: formData }),
  getLatestCV: () => request<any>('/documents/cv/latest'),
  getCVHistory: () => request<any>('/documents/cv/history'),
  deleteCVAnalysis: (id: string) => request<any>(`/documents/cv/${id}`, { method: 'DELETE' }),
  syncCVProfile: (body: { skills: string[]; researchSummary?: string }) =>
    request<any>('/documents/cv/sync-profile', { method: 'POST', body: JSON.stringify(body) }),
  analyzeSOP: (body: any) => request<any>('/documents/sop/analyze', { method: 'POST', body: JSON.stringify(body) }),
  getSOPQuestions: (targetScholarshipTitle?: string, fieldOfStudy?: string) =>
    request<any>(`/documents/sop/questions?${toQueryString({ targetScholarshipTitle, fieldOfStudy })}`),
  getSOPOutline: (body: any) => request<any>('/documents/sop/outline', { method: 'POST', body: JSON.stringify(body) }),
  refineSOPSection: (body: any) =>
    request<any>('/documents/sop/refine', { method: 'POST', body: JSON.stringify(body) }),
  saveSOPSession: (body: { targetScholarship: string; draftText: string; sessionId?: string }) =>
    request<any>('/documents/sop/sessions', { method: 'POST', body: JSON.stringify(body) }),
  getSOPSessions: () => request<any>('/documents/sop/sessions'),
  getSOPSessionById: (id: string) => request<any>(`/documents/sop/sessions/${id}`),
  deleteSOPSession: (id: string) => request<any>(`/documents/sop/sessions/${id}`, { method: 'DELETE' }),

  // Chat Sessions & Messages
  getConversations: () => request<any>('/chat/conversations'),
  createConversation: (title?: string) =>
    request<any>('/chat/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
  getMessages: (id: string) => request<any>(`/chat/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    request<any>(`/chat/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => request<any>(`/chat/conversations/${id}`, { method: 'DELETE' }),
  sendMessage: (id: string, content: string) =>
    request<any>(`/chat/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),

  // Automation console (admin only)
  getAutomationWorkflows: () => request<any>('/automation/workflows'),
  getAutomationStats: () => request<any>('/automation/stats'),
  getAutomationRuns: (params: Record<string, any> = {}) => request<any>(`/automation/runs?${toQueryString(params)}`),
  runAutomationWorkflow: (key: string, payload?: Record<string, any>) =>
    request<any>(`/automation/workflows/${key}/run`, {
      method: 'POST',
      body: JSON.stringify({ payload: payload || {} }),
    }),
};
