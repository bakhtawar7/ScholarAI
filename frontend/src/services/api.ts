import { Scholarship, ScholarshipSearchResult, ScholarshipFilterFacets, ScholarshipMatch } from '../types';

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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) };

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
    if (err?.name === 'AbortError') {
      throw new ApiError('The request timed out. Please check your connection and try again.', 408);
    }
    throw new ApiError('Cannot reach the server. Please check your connection and try again.', 0);
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
    throw new ApiError(
      data.error || data.message || `Request failed (${response.status})`,
      response.status,
      data.details
    );
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

  // Profile
  getProfile: () => request<any>('/profile'),
  updateProfile: (body: any) => request<any>('/profile', { method: 'POST', body: JSON.stringify(body) }),

  // Scholarships
  searchScholarships: (params: Record<string, any>) =>
    request<ScholarshipSearchResult>(`/scholarships?${toQueryString(params)}`),
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
  refineSOPSection: (body: any) => request<any>('/documents/sop/refine', { method: 'POST', body: JSON.stringify(body) }),
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
