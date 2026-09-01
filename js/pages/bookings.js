/* ==========================================================================
   PIHUB Dashboard — Bookings Page
   ========================================================================== */

window.bookingsPage = {
  state: { data: [], filterStatus: '', search: '' },

  // Mirrors backend accounts/permissions.py -> IsManagementOrReceptionistCreateOnly
  // Create (walk-in) allowed for management + Receptionist; no edit/delete UI exists here.
  MANAGEMENT_ROLES: ['CEO', 'LEAD_DEVELOPER', 'ADMIN'],

  canCreateWalkIn() {
    return auth.hasRole(...this.MANAGEMENT_ROLES, 'RECEPTIONIST');
  },

  async render(container) {
    const canCreate = this.canCreateWalkIn();

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:var(--space-4);">
        <div></div>
        ${canCreate ? '<button class="btn btn-primary" id="add-walkin-btn">+ New Walk-in Booking</button>' : ''}
      </div>
      <div class="table-wrapper">
        <div class="table-toolbar">
          <div class="filters-bar">
            <input class="form-input" id="booking-search" placeholder="Search name or email..." style="width:240px;" />
            <select class="form-select" id="booking-status-filter">
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
        <div id="bookings-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    if (canCreate) {
      document.getElementById('add-walkin-btn').addEventListener('click', () => this.openWalkInModal());
    }

    document.getElementById('booking-search').addEventListener('input', utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.renderTable();
    }, 350));

    document.getElementById('booking-status-filter').addEventListener('change', (e) => {
      this.state.filterStatus = e.target.value;
      this.renderTable();
    });

    await this.load();
  },

  async load() {
    try {
      const data = await api.get(CONFIG.ENDPOINTS.BOOKINGS);
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      document.getElementById('bookings-table-container').innerHTML = `
        <div class="empty-state"><h3>Couldn't load bookings</h3><p>${err.message}</p></div>
      `;
    }
  },

  renderTable() {
    const target = document.getElementById('bookings-table-container');
    let rows = this.state.data;

    if (this.state.filterStatus) {
      rows = rows.filter(b => b.status === this.state.filterStatus);
    }
    if (this.state.search) {
      const q = this.state.search;
      rows = rows.filter(b =>
        (b.customer_name || '').toLowerCase().includes(q) ||
        (b.customer_email || '').toLowerCase().includes(q)
      );
    }

    if (rows.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No bookings found</h3><p>Try adjusting your filters.</p></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Booking ID</th><th>Customer</th><th>Email</th><th>Plan</th>
            <th>Start</th><th>End</th><th>Status</th><th>Tag</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(b => `
            <tr>
              <td>#${b.id ?? '—'}</td>
              <td>${b.customer_name || '—'}</td>
              <td>${(b.customer_email || '').includes('@pihub.local') ? '<span class="badge badge-neutral">Walk-in</span>' : (b.customer_email || '—')}</td>
              <td>${b.plan_name || '—'}</td>
              <td>${utils.formatDate(b.start_date)}</td>
              <td>${utils.formatDate(b.end_date)}</td>
              <td><span class="badge ${utils.badgeClassForStatus(b.status)}">${b.status || '—'}</span></td>
              <td style="font-family:monospace;">${b.tag_code || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async openWalkInModal() {
    if (!this.canCreateWalkIn()) return; // safety net — button shouldn't be reachable anyway

    let planOptions = '<option value="">Loading plans...</option>';
    try {
      const data = await api.get(CONFIG.ENDPOINTS.WORKSPACE_PLANS);
      const plans = data.results || data || [];
      planOptions = plans
        .filter(p => p.is_active)
        .map(p => `<option value="${p.id}">${p.name} — ${p.duration_days} day(s) — ₦${p.price}</option>`)
        .join('');
      if (!planOptions) planOptions = '<option value="">No active plans available</option>';
    } catch {
      planOptions = '<option value="">Couldn\'t load plans</option>';
    }

    // Default start date/time to right now, in the format datetime-local expects
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const defaultStart = now.toISOString().slice(0, 16);

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>New Walk-in Booking</h2><span class="modal-close">&times;</span></div>
          <div class="login-error" style="background-color:var(--color-info-bg);color:var(--color-info);margin-bottom:var(--space-4);">
            For a customer paying in person. Only the name is required — add other details if the customer gives them.
          </div>
          <form id="walkin-form">
            <div class="form-group">
              <label class="form-label">Customer Name</label>
              <input class="form-input" name="customer_name" required autofocus />
            </div>
            <div class="form-group">
              <label class="form-label">Plan</label>
              <select class="form-select" name="workspace_plan" required>${planOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Start Date &amp; Time <span class="optional-tag">defaults to now — change if access starts later</span></label>
              <input class="form-input" type="datetime-local" name="start_date" value="${defaultStart}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Email <span class="optional-tag">(optional)</span></label>
              <input class="form-input" type="email" name="customer_email" />
            </div>
            <div class="form-group">
              <label class="form-label">Phone <span class="optional-tag">(optional)</span></label>
              <input class="form-input" name="customer_phone" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="walkin-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">Create &amp; Assign Tag</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#walkin-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#walkin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const body = Object.fromEntries(formData.entries());

      // Convert the datetime-local value into a full ISO string with timezone
      if (body.start_date) {
        body.start_date = new Date(body.start_date).toISOString();
      }
      if (!body.customer_email) delete body.customer_email;
      if (!body.customer_phone) delete body.customer_phone;

      try {
        const result = await api.post(`${CONFIG.ENDPOINTS.BOOKINGS}walk_in/`, body);
        if (result.tag_assigned) {
          toast.success(`Booking created — Tag ${result.booking.tag_code} assigned!`);
        } else {
          toast.error('Booking created, but no tags are currently available.');
        }
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};