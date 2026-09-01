/* ==========================================================================
   PIHUB Dashboard — Utilities
   ========================================================================== */

const utils = {
  formatDate(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatDateTime(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  formatCurrency(amount) {
    if (amount == null) return '—';
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  },

  debounce(fn, delay = 400) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  el(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  },

  qs(selector, parent = document) {
    return parent.querySelector(selector);
  },

  qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  },

  badgeClassForStatus(status) {
    const map = {
      ACTIVE: 'badge-success',
      PUBLISHED: 'badge-success',
      RESOLVED: 'badge-success',
      SENT: 'badge-success',
      SUCCESS: 'badge-success',
      PENDING: 'badge-warning',
      NEW: 'badge-warning',
      IN_PROGRESS: 'badge-info',
      DRAFT: 'badge-neutral',
      EXPIRED: 'badge-danger',
      UNAVAILABLE: 'badge-danger',
      FAILED: 'badge-danger',
      CANCELLED: 'badge-danger',
      REFUNDED: 'badge-info',
      COMING_SOON: 'badge-info',
    };
    return map[status] || 'badge-neutral';
  },

  initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  },
};

/* ---------- Toast notifications ---------- */
const toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'default') {
    this.init();
    const node = utils.el(`<div class="toast toast-${type}">${message}</div>`);
    this.container.appendChild(node);
    setTimeout(() => node.remove(), 4000);
  },

  success(message) { this.show(message, 'success'); },
  error(message) { this.show(message, 'danger'); },
};