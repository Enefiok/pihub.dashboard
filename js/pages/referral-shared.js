/* ==========================================================================
   PIHUB Dashboard - Referral shared helpers
   Loaded before the referral pages (registrations, referral-analytics, and
   later influencers and referral-codes). Exposes window.referralShared.

   Contains: role check, HTML escaping, list/pagination helper, number and
   money formatting, modal + confirm dialog, state blocks (loading, empty,
   error) and a small scoped stylesheet (all classes prefixed "rf-").
   ========================================================================== */

(function () {
  const DASH = '\u2014';
  const ALLOWED_ROLES = ['CEO', 'LEAD_DEVELOPER', 'LEAD DEVELOPER', 'ADMIN'];
  const STYLE_ID = 'rf-shared-styles';

  const modalStack = [];
  let keysBound = false;

  const CSS = `
    .rf-page { display: flex; flex-direction: column; gap: 16px; }
    .rf-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
    .rf-field { display: flex; flex-direction: column; gap: 4px; min-width: 150px; }
    .rf-field-grow { flex: 1 1 220px; }
    .rf-field > span { font-size: 12px; opacity: 0.75; }
    .rf-panel {
      background: var(--color-white, #fff);
      border: 1px solid var(--color-grey-100, #e5e7eb);
      border-radius: var(--radius-md, 8px);
      padding: 16px;
    }
    .rf-table-wrap {
      overflow-x: auto;
      background: var(--color-white, #fff);
      border: 1px solid var(--color-grey-100, #e5e7eb);
      border-radius: var(--radius-md, 8px);
    }
    .rf-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm, 14px); }
    .rf-table th, .rf-table td {
      padding: 12px 14px;
      text-align: left;
      vertical-align: middle;
      border-bottom: 1px solid var(--color-grey-100, #e5e7eb);
    }
    .rf-table th {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      opacity: 0.8;
      white-space: nowrap;
    }
    .rf-table tbody tr:last-child td { border-bottom: none; }
    .rf-table tbody tr.rf-clickable { cursor: pointer; }
    .rf-table tbody tr.rf-clickable:hover { background: var(--color-grey-50, rgba(0, 0, 0, 0.03)); }
    .rf-num { text-align: right !important; white-space: nowrap; }
    .rf-nowrap { white-space: nowrap; }
    .rf-muted { opacity: 0.7; font-size: 12px; }
    .rf-note { font-size: 12px; opacity: 0.75; margin: 0; }
    .rf-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .rf-btn-sm { padding: 4px 10px !important; font-size: 12px !important; }
    .btn.rf-danger {
      background: var(--color-danger, #dc2626);
      border-color: var(--color-danger, #dc2626);
      color: #fff;
    }
    .rf-page .btn:disabled, .rf-modal-body .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .rf-bulkbar {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: 10px 14px;
      background: var(--color-grey-50, rgba(0, 0, 0, 0.04));
      border: 1px solid var(--color-grey-100, #e5e7eb);
      border-radius: var(--radius-md, 8px);
      font-size: 14px;
    }
    .rf-bulkbar strong { margin-right: 4px; }
    .rf-pagination {
      display: flex; flex-wrap: wrap; gap: 12px;
      align-items: center; justify-content: space-between;
      font-size: 14px;
    }
    .rf-state { text-align: center; padding: 40px 16px; }
    .rf-spinner {
      width: 28px; height: 28px; margin: 0 auto 12px;
      border: 3px solid var(--color-grey-100, #e5e7eb);
      border-top-color: var(--color-primary, #ea580c);
      border-radius: 50%;
      animation: rf-spin 0.8s linear infinite;
    }
    @keyframes rf-spin { to { transform: rotate(360deg); } }
    .rf-error-text { color: var(--color-danger, #dc2626); }
    .rf-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .rf-stat-label { font-size: 12px; opacity: 0.75; }
    .rf-stat-value { font-size: 22px; font-weight: 700; margin-top: 4px; word-break: break-word; }
    .rf-charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 16px; }
    .rf-span-all { grid-column: 1 / -1; }
    .rf-chart-title { font-size: 14px; font-weight: 600; margin: 0 0 12px; }
    .rf-chart-box { position: relative; height: 280px; }
    .rf-section-title { font-size: 16px; font-weight: 600; margin: 0 0 12px; }
    .rf-detail-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 14px 20px; margin: 0 0 12px;
    }
    .rf-detail-item dt { font-size: 12px; opacity: 0.7; margin: 0 0 2px; }
    .rf-detail-item dd { margin: 0; font-size: 14px; word-break: break-word; }
    .rf-confirm-text { margin: 0 0 10px; font-size: 14px; }
    .rf-hidden { display: none !important; }

    /* forms */
    .rf-form .form-group { margin-bottom: 14px; }
    .rf-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
    @media (max-width: 560px) { .rf-form-grid { grid-template-columns: 1fr; } }
    .rf-req { color: var(--color-danger, #dc2626); }
    .rf-hint { font-size: 12px; opacity: 0.7; margin-top: 4px; }
    .rf-field-error { color: var(--color-danger, #dc2626); font-size: 12px; margin-top: 4px; }
    .rf-field-error:empty { display: none; }
    .rf-form-error {
      color: var(--color-danger, #dc2626);
      border: 1px solid var(--color-danger, #dc2626);
      border-radius: var(--radius-md, 8px);
      padding: 8px 12px;
      font-size: 13px;
      margin-bottom: 14px;
    }
    .rf-form .rf-invalid { border-color: var(--color-danger, #dc2626) !important; }
    .rf-inline-check { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
    .rf-check-list {
      max-height: 180px; overflow: auto;
      display: flex; flex-direction: column; gap: 8px;
      padding: 10px 12px;
      border: 1px solid var(--color-grey-100, #e5e7eb);
      border-radius: var(--radius-md, 8px);
    }
    .btn.rf-danger-outline {
      background: transparent;
      color: var(--color-danger, #dc2626);
      border-color: var(--color-danger, #dc2626);
    }
    .rf-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-weight: 600; }
    .rf-code-cell { display: flex; align-items: center; gap: 8px; }
    .rf-code-box {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 26px; font-weight: 700; letter-spacing: 0.08em;
      text-align: center; word-break: break-all;
      padding: 16px; margin: 12px 0 16px;
      border: 2px dashed var(--color-primary, #ea580c);
      border-radius: var(--radius-md, 8px);
    }
    .rf-toolbar-end { margin-left: auto; }
  `;

  const shared = {
    DASH,
    ALLOWED_ROLES,

    /* ---------- access ---------- */
    canAccess() {
      return auth.hasRole(...ALLOWED_ROLES);
    },

    // Renders an access-denied state and returns false when the role is not allowed.
    ensureAccess(container) {
      if (this.canAccess()) return true;
      container.innerHTML = this.emptyHtml(
        'Access denied',
        'You do not have permission to view this page.'
      );
      return false;
    },

    injectStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    },

    /* ---------- data helpers ---------- */
    esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[c]));
    },

    // Accepts a plain array or a paginated { count, next, previous, results } object.
    asList(data) {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results;
      return [];
    },

    isPaginated(data) {
      return !!data && !Array.isArray(data) && Array.isArray(data.results);
    },

    // Fetches every page of a list endpoint (plain array or paginated).
    async fetchAll(endpoint, params) {
      const out = [];
      for (let page = 1; page <= 20; page += 1) {
        const p = page === 1 ? (params || {}) : Object.assign({}, params || {}, { page });
        const data = await api.get(endpoint, p);
        out.push(...this.asList(data));
        if (!(this.isPaginated(data) && data.next)) break;
      }
      return out;
    },

    // First key on obj whose value is neither null/undefined nor an empty string.
    pick(obj, ...keys) {
      if (!obj || typeof obj !== 'object') return undefined;
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
      }
      return undefined;
    },

    // Trimmed non-empty string, or null.
    str(value) {
      if (value === undefined || value === null) return null;
      if (typeof value === 'object') return null;
      const s = String(value).trim();
      return s === '' ? null : s;
    },

    // Number or null. Handles "10000.00" strings.
    toNumber(value) {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      if (typeof value === 'boolean' || typeof value === 'object') return null;
      const n = parseFloat(String(value).replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    },

    cssVar(name, fallback) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
      } catch (e) {
        return fallback;
      }
    },

    /* ---------- formatting (never returns "undefined" or "NaN") ---------- */
    money(value) {
      const n = this.toNumber(value);
      return n === null ? DASH : utils.formatCurrency(n);
    },

    num(value) {
      const n = this.toNumber(value);
      return n === null ? DASH : n.toLocaleString('en-NG');
    },

    percent(value) {
      const n = this.toNumber(value);
      return n === null ? DASH : `${Number(n.toFixed(2))}%`;
    },

    date(iso) {
      if (!iso || isNaN(new Date(iso).getTime())) return DASH;
      return utils.formatDate(iso);
    },

    dateTime(iso) {
      if (!iso || isNaN(new Date(iso).getTime())) return DASH;
      return utils.formatDateTime(iso);
    },

    errMsg(err) {
      return (err && err.message) ? err.message : 'Something went wrong.';
    },

    // toast.show inserts HTML, so always escape text that came from the API.
    notifyError(message) { toast.error(this.esc(message)); },
    notifySuccess(message) { toast.success(this.esc(message)); },

    statusBadge(status) {
      const s = this.str(status);
      if (!s) return DASH;
      const key = s.toLowerCase();
      const cls = key === 'paid' ? 'badge-success'
        : key === 'pending' ? 'badge-warning'
        : key === 'cancelled' ? 'badge-danger'
        : 'badge-neutral';
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      return `<span class="badge ${cls}">${this.esc(label)}</span>`;
    },

    /* ---------- state blocks ---------- */
    loadingHtml(message) {
      return `<div class="rf-state"><div class="rf-spinner"></div><div>${this.esc(message || 'Loading...')}</div></div>`;
    },

    emptyHtml(title, message) {
      return `<div class="empty-state rf-state"><h3>${this.esc(title)}</h3><p>${this.esc(message || '')}</p></div>`;
    },

    // The retry button carries data-rf-retry; pages listen for it.
    errorHtml(message) {
      return `
        <div class="empty-state rf-state">
          <h3>Could not load data</h3>
          <p class="rf-error-text">${this.esc(message || 'Something went wrong.')}</p>
          <button type="button" class="btn btn-secondary" data-rf-retry>Try again</button>
        </div>`;
    },

    /* ---------- forms ---------- */
    flattenError(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.map((v) => this.flattenError(v)).filter(Boolean).join(' ');
      if (typeof value === 'object') {
        return Object.keys(value).map((k) => this.flattenError(value[k])).filter(Boolean).join(' ');
      }
      return String(value);
    },

    // Splits an ApiError into per-field messages and one general message.
    // fieldNames lists the form field names that have an error slot.
    parseFormErrors(err, fieldNames) {
      const out = { fields: {}, general: '' };
      const data = err && err.data && typeof err.data === 'object' && !Array.isArray(err.data) ? err.data : null;
      if (!data) {
        out.general = this.errMsg(err);
        return out;
      }
      const general = [];
      Object.keys(data).forEach((key) => {
        const msg = this.flattenError(data[key]);
        if (!msg) return;
        if (fieldNames.indexOf(key) !== -1) out.fields[key] = msg;
        else general.push(msg);
      });
      out.general = general.join(' ');
      if (!Object.keys(out.fields).length && !out.general) out.general = this.errMsg(err);
      return out;
    },

    clearFormErrors(form) {
      form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
      form.querySelectorAll('.rf-invalid').forEach((el) => el.classList.remove('rf-invalid'));
      const general = form.querySelector('[data-form-error]');
      if (general) {
        general.textContent = '';
        general.classList.add('rf-hidden');
      }
    },

    // parsed = { fields: { name: 'message' }, general: 'message' }. Uses textContent, so it is safe.
    showFormErrors(form, parsed) {
      this.clearFormErrors(form);
      let first = null;
      const general = [];
      if (parsed.general) general.push(parsed.general);

      Object.keys(parsed.fields || {}).forEach((name) => {
        const slot = form.querySelector(`[data-error-for="${name}"]`);
        if (!slot) {
          general.push(parsed.fields[name]);
          return;
        }
        slot.textContent = parsed.fields[name];
        const input = form.querySelector(`[name="${name}"]`);
        if (input) {
          input.classList.add('rf-invalid');
          if (!first) first = input;
        }
      });

      const box = form.querySelector('[data-form-error]');
      if (box && general.length) {
        box.textContent = general.join(' ');
        box.classList.remove('rf-hidden');
      }
      if (first && typeof first.focus === 'function') first.focus();
    },

    // Disables or re-enables every control in a form while a request runs.
    setFormBusy(form, busy, saveLabel) {
      form.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = busy; });
      const save = form.querySelector('[data-rf-save]');
      if (save) {
        if (busy) {
          save.dataset.label = save.textContent;
          save.textContent = 'Saving...';
        } else {
          save.textContent = saveLabel || save.dataset.label || 'Save';
        }
      }
    },

    // Converts an ISO string to the value format of <input type="datetime-local"> (local time).
    toDateTimeLocal(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    },

    async copyText(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (e) { /* fall through to the legacy path */ }
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e) {
        return false;
      }
    },

    /* ---------- modal + confirm ---------- */
    bindKeys() {
      if (keysBound) return;
      keysBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const top = modalStack[modalStack.length - 1];
        if (top && !top.locked) top.close();
      });
    },

    // Uses the dashboard's modal-overlay / modal / modal-header / modal-close markup.
    modal({ title, width = 560, bodyHtml = '', onClose } = {}) {
      this.injectStyles();
      this.bindKeys();

      const overlay = utils.el(`
        <div class="modal-overlay">
          <div class="modal" style="width:${Number(width) || 560}px;max-width:94vw;max-height:90vh;overflow:auto;">
            <div class="modal-header">
              <h2>${this.esc(title)}</h2>
              <span class="modal-close" role="button" aria-label="Close">&times;</span>
            </div>
            <div class="rf-modal-body">${bodyHtml}</div>
          </div>
        </div>
      `);

      const handle = {
        overlay,
        body: overlay.querySelector('.rf-modal-body'),
        locked: false,
        closed: false,
        setBody(html) { this.body.innerHTML = html; },
        close() {
          if (this.closed) return;
          this.closed = true;
          const i = modalStack.indexOf(this);
          if (i !== -1) modalStack.splice(i, 1);
          overlay.remove();
          if (typeof onClose === 'function') onClose();
        },
      };

      overlay.querySelector('.modal-close').addEventListener('click', () => {
        if (!handle.locked) handle.close();
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !handle.locked) handle.close();
      });

      modalStack.push(handle);
      document.body.appendChild(overlay);
      return handle;
    },

    /*
      Confirmation dialog that runs the request itself so its buttons stay
      disabled while the request is in flight.
      Resolves to:
        null                          the user dismissed the dialog
        { ok: true,  result }         run() succeeded
        { ok: false, error }          run() threw (the dialog closes either way)
    */
    confirmAction({ title, messages = [], confirmLabel = 'Confirm', cancelLabel = 'Go back', danger = false, run }) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        const paragraphs = (Array.isArray(messages) ? messages : [messages])
          .map((m) => `<p class="rf-confirm-text">${this.esc(m)}</p>`)
          .join('');

        const handle = this.modal({
          title,
          width: 440,
          bodyHtml: `
            ${paragraphs}
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-rf-no>${this.esc(cancelLabel)}</button>
              <button type="button" class="btn ${danger ? 'rf-danger' : 'btn-primary'}" data-rf-yes>${this.esc(confirmLabel)}</button>
            </div>`,
          onClose: () => finish(null),
        });

        const yes = handle.overlay.querySelector('[data-rf-yes]');
        const no = handle.overlay.querySelector('[data-rf-no]');

        no.addEventListener('click', () => handle.close());
        yes.addEventListener('click', async () => {
          yes.disabled = true;
          no.disabled = true;
          handle.locked = true;
          yes.textContent = 'Working...';
          try {
            const result = await run();
            finish({ ok: true, result });
          } catch (error) {
            finish({ ok: false, error });
          }
          handle.locked = false;
          handle.close();
        });
      });
    },

    // Information dialog shown when the server refuses a delete (400 or 409).
    // The server message is shown as is; onAlt (optional) offers a safer action.
    blockedDialog({ title, message, hint, altLabel, onAlt }) {
      const handle = this.modal({
        title,
        width: 440,
        bodyHtml: `
          <p class="rf-confirm-text rf-error-text">${this.esc(message)}</p>
          ${hint ? `<p class="rf-confirm-text">${this.esc(hint)}</p>` : ''}
          <div class="modal-footer">
            ${onAlt ? `<button type="button" class="btn btn-primary" data-rf-alt>${this.esc(altLabel || 'Continue')}</button>` : ''}
            <button type="button" class="btn btn-secondary" data-rf-close>Close</button>
          </div>`,
      });
      handle.overlay.addEventListener('click', (e) => {
        if (e.target.closest('[data-rf-close]')) {
          handle.close();
        } else if (e.target.closest('[data-rf-alt]')) {
          handle.close();
          if (typeof onAlt === 'function') onAlt();
        }
      });
      return handle;
    },
  };

  window.referralShared = shared;
})();