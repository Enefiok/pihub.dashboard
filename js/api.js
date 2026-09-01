/* ==========================================================================
   PIHUB Dashboard — API Wrapper
   ========================================================================== */

const api = {
  getToken() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
  },

  buildHeaders(isFormData = false) {
    const headers = {};
    const token = this.getToken();

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Token ${token}`;
    }
    return headers;
  },

  async request(endpoint, { method = 'GET', body = null, isFormData = false, params = null } = {}) {
    let url = `${CONFIG.API_BASE_URL}${endpoint}`;

    if (params) {
      const query = new URLSearchParams(params).toString();
      if (query) url += `?${query}`;
    }

    const options = {
      method,
      headers: this.buildHeaders(isFormData),
    };

    if (body) {
      options.body = isFormData ? body : JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, options);
    } catch (networkErr) {
      throw new ApiError('Network error — is the backend running?', 0, null);
    }

    // Auth expired / invalid — force logout
    if (response.status === 401) {
      auth.logout();
      throw new ApiError('Session expired. Please log in again.', 401, null);
    }

    let data = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    }

    if (!response.ok) {
      const message = this.extractErrorMessage(data) || `Request failed (${response.status})`;
      throw new ApiError(message, response.status, data);
    }

    return data;
  },

  extractErrorMessage(data) {
    if (!data) return null;
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.message === 'string') return data.message;
    // DRF field errors: { field: ["msg"] }
    const firstKey = Object.keys(data)[0];
    if (firstKey && Array.isArray(data[firstKey])) {
      return `${firstKey}: ${data[firstKey][0]}`;
    }
    return null;
  },

  get(endpoint, params) {
    return this.request(endpoint, { method: 'GET', params });
  },
  post(endpoint, body, isFormData = false) {
    return this.request(endpoint, { method: 'POST', body, isFormData });
  },
  patch(endpoint, body, isFormData = false) {
    return this.request(endpoint, { method: 'PATCH', body, isFormData });
  },
  put(endpoint, body, isFormData = false) {
    return this.request(endpoint, { method: 'PUT', body, isFormData });
  },
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}