import { API_URL } from '../config';
import { session } from './session';

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : 'Request failed.');
    this.status = status;
  }
}

export const toQueryString = (params = {}) => {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
};

const formatDetail = (detail) => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first && typeof first.msg === 'string') return first.msg;
  }
  return 'Request failed.';
};

// Authorization denials do not invalidate an otherwise valid session.
const AUTH_FAILURES = new Set([401]);

let redirecting = false;

const redirectToLogin = (loginPath = '/login') => {
  if (redirecting) return;
  const path = window.location.pathname;
  if (path === loginPath || path.startsWith('/register') || path.startsWith('/faculty/register')) return;
  redirecting = true;
  window.location.href = loginPath;
};

const handleResponse = async (response, {
  hadAuth,
  authFailurePath,
  onAuthFailure = session.clearAuth,
} = {}) => {
  // A 401 only means the session is dead when the request actually carried a
  // token. A bare login attempt with bad credentials must not wipe a good
  // session or bounce the user around.
  if (AUTH_FAILURES.has(response.status) && hadAuth) {
    onAuthFailure();
    redirectToLogin(authFailurePath);
    throw new ApiError(response.status, 'Session expired. Please log in again.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, formatDetail(data?.detail));
  }
  return data;
};

export const apiClient = {
  async request(path, {
    method = 'GET',
    body,
    query,
    auth = true,
    authToken,
    authFailurePath,
    onAuthFailure,
  } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = auth
      ? (authToken !== undefined ? authToken : session.token)
      : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_URL}${path}${toQueryString(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) return null;
    // Whether this request carried a token is decided from the value actually
    // sent, not from a fresh read that another request may already have cleared.
    return handleResponse(response, {
      hadAuth: Boolean(token),
      authFailurePath,
      onAuthFailure,
    });
  },

  get: (path, options) => apiClient.request(path, { method: 'GET', ...options }),
  post: (path, body, options) => apiClient.request(path, { method: 'POST', body, ...options }),
  patch: (path, body, options) => apiClient.request(path, { method: 'PATCH', body, ...options }),
  put: (path, body, options) => apiClient.request(path, { method: 'PUT', body, ...options }),
  delete: (path, options) => apiClient.request(path, { method: 'DELETE', ...options }),
};