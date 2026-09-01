/* ==========================================================================
   PIHUB Dashboard — Staff Management Page (CEO / Lead Developer only)
   ========================================================================== */

window.staffPage = {
  state: { data: [] },

  async render(container) {
    if (!auth.isCEOorLeadDev()) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Access restricted</h3>
          <p>Only the CEO or Lead Developer can manage staff accounts.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:var(--space-4);">
        <div></div>
        <button class="btn btn-primary" id="add-staff-btn">+ Add Staff</button>
      </div>
      <div class="table-wrapper">
        <div id="staff-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    document.getElementById('add-staff-btn').addEventListener('click', () => this.openModal());
    await this.load();
  },

  async load() {
    const target = document.getElementById('staff-table-container');
    try {
      const data = await api.get('/api/accounts/staff/');
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `
        <div class="empty-state">
          <h3>Staff list endpoint not confirmed yet</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  },

  renderTable() {
    const target = document.getElementById('staff-table-container');
    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No staff found</h3></div>`;
      return;
    }

    const currentUser = auth.getUser();

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Phone</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          ${this.state.data.map(s => `
            <tr>
              <td>${s.username || '—'}</td>
              <td>${s.email || '—'}</td>
              <td><span class="badge badge-info">${s.role || '—'}</span></td>
              <td>${s.phone_number || '—'}</td>
              <td><span class="badge ${s.is_active ? 'badge-success' : 'badge-neutral'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
              <td>${utils.formatDate(s.date_joined)}</td>
              <td class="table-actions">
                ${currentUser && s.id !== currentUser.id
                  ? `<button class="btn btn-sm btn-secondary reset-btn" data-id="${s.id}" data-username="${s.username}">Reset Password</button>`
                  : '<span style="color:var(--color-grey-500);font-size:var(--font-size-xs);">This is you</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    utils.qsa('.reset-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.openResetModal(btn.dataset.id, btn.dataset.username));
    });
  },

  openResetModal(userId, username) {
    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal" style="width:420px;">
          <div class="modal-header"><h2>Reset Password</h2><span class="modal-close">&times;</span></div>
          <div class="login-error" style="background-color:var(--color-info-bg);color:var(--color-info);margin-bottom:var(--space-4);">
            You're resetting the password for <strong>${username}</strong>. Confirm with your own password to proceed.
          </div>
          <form id="reset-form">
            <div class="form-group">
              <label class="form-label">Your Password <span class="optional-tag">(to confirm it's really you)</span></label>
              <input class="form-input" type="password" name="admin_password" required />
            </div>
            <div class="form-group">
              <label class="form-label">New Password for ${username}</label>
              <input class="form-input" type="password" name="new_password" required minlength="8" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="reset-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">Reset Password</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#reset-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#reset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const body = Object.fromEntries(formData.entries());

      try {
        await api.patch(`/api/accounts/staff/${userId}/reset-password/`, body);
        toast.success(`Password reset for ${username}`);
        overlay.remove();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },

  openModal() {
    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>Add New Staff</h2><span class="modal-close">&times;</span></div>
          <div class="login-error" style="background-color:var(--color-info-bg);color:var(--color-info);margin-bottom:var(--space-4);">
            A temporary password is set below. The new staff member will be prompted to change it on first login.
          </div>
          <form id="staff-form">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input class="form-input" name="username" required />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-input" type="email" name="email" required />
            </div>
            <div class="form-group">
              <label class="form-label">Temporary Password</label>
              <input class="form-input" type="password" name="password" required />
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-select" name="role" required>
                <option value="ADMIN">Admin</option>
                <option value="RECEPTIONIST">Receptionist</option>
                <option value="LEAD_DEVELOPER">Lead Developer</option>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="MARKETER">Marketer</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input class="form-input" name="phone_number" required />
            </div>
            <div class="form-group">
              <label class="form-label" style="display:flex;align-items:center;gap:var(--space-2);">
                <input type="checkbox" name="is_active" checked style="width:auto;" /> Active
              </label>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="staff-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Staff</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#staff-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#staff-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const body = Object.fromEntries(formData.entries());
      body.is_active = formData.get('is_active') === 'on';

      try {
        await api.post(CONFIG.ENDPOINTS.CREATE_STAFF, body);
        toast.success('Staff member created successfully');
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};