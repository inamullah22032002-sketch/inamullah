export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', status: number = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('funclubsi_token') : null;

export function setApiToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('funclubsi_token', token);
    } else {
      localStorage.removeItem('funclubsi_token');
    }
  }
}

export function getApiToken(): string | null {
  return authToken;
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch (networkErr: any) {
    throw new ApiError(
      `Network connection failure: ${networkErr.message || 'Unable to contact server.'}`,
      'NETWORK_FAILURE',
      0
    );
  }

  // Handle No Content
  if (response.status === 204) {
    return {} as T;
  }

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      data = { message: 'Invalid JSON response from server' };
    }
  } else {
    // If response is HTML or text, NEVER display HTML in UI
    const rawText = await response.text();
    // Log details only to developer console
    console.warn(`[API] Non-JSON response received from ${endpoint} (${response.status}):`, rawText.slice(0, 200));

    if (response.status === 404) {
      data = {
        error: 'NOT_FOUND',
        message: 'Server endpoint was not found (404).',
      };
    } else if (response.status === 413) {
      data = {
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Payload Too Large (413). Large video files must be uploaded via direct Cloudflare R2 multipart streaming.',
      };
    } else if (response.status >= 500) {
      data = {
        error: 'SERVER_ERROR',
        message: `Server encountered an internal error (${response.status}).`,
      };
    } else {
      data = {
        error: 'UNEXPECTED_RESPONSE',
        message: `Server returned HTTP status ${response.status}.`,
      };
    }
  }

  if (!response.ok) {
    const errorCode = data?.error || (response.status === 413 ? 'PAYLOAD_TOO_LARGE' : response.status === 404 ? 'NOT_FOUND' : 'API_ERROR');
    const errorMessage = data?.message || `Request failed with HTTP status ${response.status}`;
    throw new ApiError(errorMessage, errorCode, response.status, data);
  }

  return data as T;
}

export const api = {
  // Auth
  auth: {
    signup: (data: any) => request<any>('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: any) => request<any>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    adminLogin: (data: any) => request<any>('/api/auth/admin/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => request<any>('/api/auth/me'),
    logout: () => request<any>('/api/auth/logout', { method: 'POST' }),
    updateProfile: (data: any) => request<any>('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
    forgotPassword: (email: string) => request<any>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  },

  // Movies & Catalog
  movies: {
    list: (params: { q?: string; genre?: string; type?: string; status?: string; sort?: string; limit?: number; offset?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.q) q.set('q', params.q);
      if (params.genre) q.set('genre', params.genre);
      if (params.type) q.set('type', params.type);
      if (params.status) q.set('status', params.status);
      if (params.sort) q.set('sort', params.sort);
      if (params.limit) q.set('limit', String(params.limit));
      if (params.offset) q.set('offset', String(params.offset));
      return request<{ movies: any[]; total: number }>(`/api/movies?${q.toString()}`);
    },
    featured: () => request<{ featured: any[] }>('/api/movies/featured'),
    genres: () => request<{ genres: string[] }>('/api/movies/genres'),
    get: (slugOrId: string) => request<{ movie: any; userState: any }>(`/api/movies/${encodeURIComponent(slugOrId)}`),
    
    // User lists
    getWatchlist: () => request<{ watchlist: any[] }>('/api/movies/user/watchlist'),
    addToWatchlist: (movieId: string) => request<any>(`/api/movies/user/watchlist/${movieId}`, { method: 'POST' }),
    removeFromWatchlist: (movieId: string) => request<any>(`/api/movies/user/watchlist/${movieId}`, { method: 'DELETE' }),
    getFavorites: () => request<{ favorites: any[] }>('/api/movies/user/favorites'),
    addToFavorites: (movieId: string) => request<any>(`/api/movies/user/favorites/${movieId}`, { method: 'POST' }),
    removeFromFavorites: (movieId: string) => request<any>(`/api/movies/user/favorites/${movieId}`, { method: 'DELETE' }),
    getProgress: () => request<{ continueWatching: any[] }>('/api/movies/user/progress'),
    saveProgress: (movieId: string, currentTime: number, duration: number) =>
      request<any>(`/api/movies/user/progress/${movieId}`, {
        method: 'POST',
        body: JSON.stringify({ currentTime, duration }),
      }),
  },

  // Admin
  admin: {
    stats: () => request<any>('/api/admin/stats'),
    health: () => request<any>('/api/admin/health'),
    createMovie: (data: any) => request<any>('/api/movies/admin', { method: 'POST', body: JSON.stringify(data) }),
    updateMovie: (id: string, data: any) => request<any>(`/api/movies/admin/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMovie: (id: string) => request<any>(`/api/movies/admin/${id}`, { method: 'DELETE' }),
    analyzeUrl: (url: string) => request<any>('/api/movies/admin/importers/analyze', { method: 'POST', body: JSON.stringify({ url }) }),
    aiAssist: (title: string, context?: string) =>
      request<any>('/api/movies/admin/ai/metadata-assist', {
        method: 'POST',
        body: JSON.stringify({ title, context }),
      }),
    
    // Storage & Uploads
    getUploads: () => request<any>('/api/admin/uploads'),
    deleteUpload: (id: string) => request<any>(`/api/admin/uploads/${id}`, { method: 'DELETE' }),
    presignSingle: (metadata: { filename: string; size: number; contentType: string; movieId?: string }) =>
      request<{ url: string; presignedUrl: string; objectKey: string; publicUrl: string; isDirectR2: boolean }>('/api/admin/uploads/presign', {
        method: 'POST',
        body: JSON.stringify(metadata),
      }),
    completeSingle: (metadata: { objectKey: string; filename: string; size: number; mimeType: string; movieId?: string }) =>
      request<{ status: string; publicUrl: string; objectKey: string }>('/api/admin/uploads/complete-single', {
        method: 'POST',
        body: JSON.stringify(metadata),
      }),
    initiateMultipart: (metadata: { filename: string; size: number; mimeType: string; movieId?: string }) =>
      request<any>('/api/admin/uploads/multipart/initiate', { method: 'POST', body: JSON.stringify(metadata) }),
    signMultipartPart: (data: { uploadId: string; objectKey: string; partNumber: number }) =>
      request<any>('/api/admin/uploads/multipart/sign', { method: 'POST', body: JSON.stringify(data) }),
    completeMultipart: (data: { uploadId: string; objectKey: string; parts: { PartNumber: number; ETag: string }[] }) =>
      request<any>('/api/admin/uploads/multipart/complete', { method: 'POST', body: JSON.stringify(data) }),
    abortMultipart: (data: { uploadId: string; objectKey: string }) =>
      request<any>('/api/admin/uploads/multipart/abort', { method: 'POST', body: JSON.stringify(data) }),

    // Security & Password Management
    changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      request<{ success: boolean; message: string }>('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Users & Roles
    getUsers: () => request<any>('/api/admin/users'),
    updateUserRole: (id: string, role: string) =>
      request<any>(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    getRoles: () => request<any>('/api/admin/roles'),

    // Audit logs & Reports
    getAuditLogs: (params: { action?: string; user?: string; limit?: number; offset?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.action) q.set('action', params.action);
      if (params.user) q.set('user', params.user);
      if (params.limit) q.set('limit', String(params.limit));
      if (params.offset) q.set('offset', String(params.offset));
      return request<any>(`/api/admin/audit-logs?${q.toString()}`);
    },
    sendWeeklyReport: (recipientEmail?: string) =>
      request<any>('/api/admin/audit-logs/send-weekly-report', {
        method: 'POST',
        body: JSON.stringify({ recipientEmail }),
      }),
  },
};
