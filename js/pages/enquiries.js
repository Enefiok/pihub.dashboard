/* ==========================================================================
   PIHUB Dashboard — Enquiries Page
   ========================================================================== */

window.enquiriesPage = {
  state: { data: [], filterStatus: '' },

  // Mirrors backend accounts/permissions.py -> IsManagementOrReadOnly
  // (assumed — enquiries has no dedicated permission class in what you shared,
  // so this uses the "default policy for most modules"; confirm if enquiries
  // actually uses a different class)
  WRITE_ROLES: ['CEO', 'LEAD_DEVELOPER', 'ADMIN'],

  canWrite() {
    return auth.hasRole(...this.WRITE_ROLES);
  },

  async render(container) {
    container.innerHTML = `
      <div class="table-wrapper">
        <div class="table-toolbar">
          <select class="form-select" id="enquiry-status-filter">
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        <div id="enquiries-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    document.getElementById('enquiry-status-filter').addEventListener('change', (e) => {
      this.state.filterStatus = e.target.value;
      this.load();
    });

    await this.load();
  },

  async load() {
    const target = document.getElementById('enquiries-table-container');
    try {
      const params = this.state.filterStatus ? { status: this.state.filterStatus } : null;
      const data = await api.get(CONFIG.ENDPOINTS.ENQUIRIES_STAFF, params);
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load enquiries</h3><p>${err.message}</p></div>`;
    }
  },

  renderTable() {
    const target = document.getElementById('enquiries-table-container');
    const canWrite = this.canWrite();

    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No enquiries found</h3></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Service</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${this.state.data.map(e => `
            <tr data-id="${e.id}" style="cursor:pointer;" class="enquiry-row">
              <td>${e.name || '—'}</td>
              <td>${e.email || '—'}</td>
              <td>${this.serviceLabel(e.service_type)}</td>
              <td>${e.subject || '—'}</td>
              <td><span class="badge ${utils.badgeClassForStatus(e.status)}">${this.statusLabel(e.status)}</span></td>
              <td class="table-actions">
                <button class="btn btn-sm btn-secondary view-btn" data-id="${e.id}">View</button>
                ${canWrite ? `
                  ${e.status !== 'IN_PROGRESS' ? `<button class="btn btn-sm btn-secondary progress-btn" data-id="${e.id}">In Progress</button>` : ''}
                  ${e.status !== 'RESOLVED' ? `<button class="btn btn-sm btn-primary resolve-btn" data-id="${e.id}">Resolve</button>` : ''}
                  <button class="btn btn-sm btn-danger delete-btn" data-id="${e.id}">Delete</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    utils.qsa('.view-btn', target).forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const enquiry = this.state.data.find(e => e.id == btn.dataset.id);
        this.openViewModal(enquiry);
      });
    });

    // Clicking anywhere on the row also opens the detail view (except on action buttons)
    utils.qsa('.enquiry-row', target).forEach(row => {
      row.addEventListener('click', () => {
        const enquiry = this.state.data.find(e => e.id == row.dataset.id);
        this.openViewModal(enquiry);
      });
    });

    if (!canWrite) return;

    utils.qsa('.resolve-btn', target).forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.updateStatus(btn.dataset.id, 'RESOLVED');
      });
    });
    utils.qsa('.progress-btn', target).forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.updateStatus(btn.dataset.id, 'IN_PROGRESS');
      });
    });
    utils.qsa('.delete-btn', target).forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.deleteEnquiry(btn.dataset.id);
      });
    });
  },

  serviceLabel(value) {
    const map = {
      CONFERENCE_ROOM: 'Conference Room',
      PRIVATE_SPACE: 'Private Space',
      PODCAST: 'Podcast Studio',
      GENERAL: 'General Enquiry',
    };
    return map[value] || value || '—';
  },

  statusLabel(value) {
    const map = { NEW: 'New', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' };
    return map[value] || value || '—';
  },

  openViewModal(enquiry) {
    const canWrite = this.canWrite();

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>Enquiry Details</h2><span class="modal-close">&times;</span></div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-5);">
            <span class="badge ${utils.badgeClassForStatus(enquiry.status)}">${this.statusLabel(enquiry.status)}</span>
            <span style="font-size:var(--font-size-xs);color:var(--color-grey-500);">${utils.formatDateTime(enquiry.created_at)}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Name</label>
            <div style="font-size:var(--font-size-sm);">${enquiry.name || '—'}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <div style="font-size:var(--font-size-sm);">${enquiry.email || '—'}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <div style="font-size:var(--font-size-sm);">${enquiry.phone || '—'}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Service</label>
            <div style="font-size:var(--font-size-sm);">${this.serviceLabel(enquiry.service_type)}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Subject</label>
            <div style="font-size:var(--font-size-sm);">${enquiry.subject || '—'}</div>
          </div>
          <div class="form-group">
            <label class="form-label">Message</label>
            <div style="font-size:var(--font-size-sm);white-space:pre-wrap;background:var(--color-grey-50);padding:var(--space-3);border-radius:var(--radius-md);border:1px solid var(--color-grey-100);">${enquiry.message || '—'}</div>
          </div>

          ${canWrite ? `
            <div class="modal-footer">
              ${enquiry.status !== 'IN_PROGRESS' ? `<button type="button" class="btn btn-secondary" id="modal-progress-btn">Mark In Progress</button>` : ''}
              ${enquiry.status !== 'RESOLVED' ? `<button type="button" class="btn btn-primary" id="modal-resolve-btn">Mark Resolved</button>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());

    const progressBtn = overlay.querySelector('#modal-progress-btn');
    if (progressBtn) {
      progressBtn.addEventListener('click', async () => {
        await this.updateStatus(enquiry.id, 'IN_PROGRESS');
        overlay.remove();
      });
    }

    const resolveBtn = overlay.querySelector('#modal-resolve-btn');
    if (resolveBtn) {
      resolveBtn.addEventListener('click', async () => {
        await this.updateStatus(enquiry.id, 'RESOLVED');
        overlay.remove();
      });
    }
  },

  async updateStatus(id, status) {
    if (!this.canWrite()) return; // extra guard; server enforces the real rule
    try {
      await api.patch(`${CONFIG.ENDPOINTS.ENQUIRIES_STAFF}${id}/`, { status });
      toast.success(`Enquiry marked as ${this.statusLabel(status).toLowerCase()}`);
      this.load();
    } catch (err) {
      toast.error(err.message);
    }
  },

  async deleteEnquiry(id) {
    if (!this.canWrite()) return; // extra guard; server enforces the real rule
    if (!confirm('Delete this enquiry? This cannot be undone.')) return;
    try {
      await api.delete(`${CONFIG.ENDPOINTS.ENQUIRIES_STAFF}${id}/`);
      toast.success('Enquiry deleted');
      this.load();
    } catch (err) {
      toast.error(err.message);
    }
  },
};