/* ==========================================================================
   PIHUB Dashboard — Auth
   ========================================================================== */

const auth = {
  async login(username, password) {
    const data = await api.post(CONFIG.ENDPOINTS.LOGIN, { username, password });

    // Adjust these keys once we confirm the exact login response shape
    // from the backend dev (assuming { token, user: {...} } for now).
    if (!data || !data.token) {
      throw new ApiError('Unexpected login response from server.', 500, data);
    }

    localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, data.token);
    if (data.user) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(data.user));
    }
    return data;
  },

  logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
    window.location.href = 'login.html';
  },

  isAuthenticated() {
    return !!localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
  },

  getUser() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  },

  getRole() {
    const user = this.getUser();
    return user ? user.role : null;
  },

  // Call at the top of dashboard.html — redirects to login if no token
  guardDashboard() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
    }
  },

  // Call at the top of login.html — skip login if already authenticated
  guardLogin() {
    if (this.isAuthenticated()) {
      window.location.href = 'dashboard.html';
    }
  },

  // Role-based checks for showing/hiding UI (Staff module, financials, etc.)
  hasRole(...allowedRoles) {
    const role = this.getRole();
    return role && allowedRoles.includes(role);
  },

  isCEOorLeadDev() {
    return this.hasRole('CEO', 'LEAD_DEVELOPER', 'LEAD DEVELOPER');
  },
};