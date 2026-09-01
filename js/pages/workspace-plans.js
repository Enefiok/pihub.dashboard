/* ==========================================================================
   PIHUB Dashboard — Workspace Plans Page
   ========================================================================== */

window.workspacePlansPage = {
  state: { data: [] },

  WRITE_ROLES: ['CEO', 'LEAD_DEVELOPER', 'ADMIN'],

  canWrite() {
    return auth.hasRole(...this.WRITE_ROLES);
  },

  async render(container) {
    const canWrite = this.canWrite();

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:var(--space-4);">
        <div></div>
        ${canWrite ? '<button class="btn btn-primary" id="add-plan-btn">+ Add New Plan</button>' : ''}
      </div>
      <div class="table-wrapper">
        <div id="plans-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    if (canWrite) {
      document.getElementById('add-plan-btn').addEventListener('click', () => this.openModal());
    }
    await this.load();
  },

  async load() {
    const target = document.getElementById('plans-table-container');
    try {
      const data = await api.get(CONFIG.ENDPOINTS.WORKSPACE_PLANS);
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load plans</h3><p>${err.message}</p></div>`;
    }
  },

  renderTable() {
    const target = document.getElementById('plans-table-container');
    const canWrite = this.canWrite();

    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No plans found</h3><p>${canWrite ? 'Click "Add New Plan" to get started.' : 'Check back later.'}</p></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Type</th><th>Duration (days)</th><th>Price</th><th>Status</th>${canWrite ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>
          ${this.state.data.map(p => `
            <tr>
              <td>${p.name || '—'}</td>
              <td>${p.duration_days ?? '—'}</td>
              <td>${p.price != null ? `₦${p.price}` : '—'}</td>
              <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-neutral'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
              ${canWrite ? `
                <td class="table-actions">
                  <button class="btn btn-sm btn-secondary edit-btn" data-id="${p.id}">Edit</button>
                  <button class="btn btn-sm btn-danger delete-btn" data-id="${p.id}">Delete</button>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    if (!canWrite) return;

    utils.qsa('.edit-btn', target).forEach(btn => {
      btn.addEventListener('click', () => {
        const plan = this.state.data.find(p => p.id == btn.dataset.id);
        this.openModal(plan);
      });
    });

    utils.qsa('.delete-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.deletePlan(btn.dataset.id));
    });
  },

  async deletePlan(id) {
    if (!this.canWrite()) return; // extra guard; server enforces the real rule
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    try {
      await api.delete(`${CONFIG.ENDPOINTS.WORKSPACE_PLANS}${id}/`);
      toast.success('Plan deleted');
      this.load();
    } catch (err) {
      toast.error(err.message);
    }
  },

  openModal(plan = null) {
    if (!this.canWrite()) return; // safety net — button shouldn't be reachable anyway

    const isEdit = !!plan;

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>${isEdit ? 'Edit Plan' : 'Add New Plan'}</h2><span class="modal-close">&times;</span></div>
          <form id="plan-form">
            <div class="form-group">
              <label class="form-label">Plan Type</label>
              <select class="form-select" name="name" required>
                <option value="DAILY" ${isEdit && plan.name === 'DAILY' ? 'selected' : ''}>Daily</option>
                <option value="WEEKLY" ${isEdit && plan.name === 'WEEKLY' ? 'selected' : ''}>Weekly</option>
                <option value="MONTHLY" ${isEdit && plan.name === 'MONTHLY' ? 'selected' : ''}>Monthly</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Duration (days)</label>
              <input class="form-input" type="number" name="duration_days" value="${isEdit ? plan.duration_days : ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Price (₦)</label>
              <input class="form-input" type="number" step="0.01" name="price" value="${isEdit ? plan.price : ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Description <span class="optional-tag">(optional)</span></label>
              <textarea class="form-textarea" name="description" rows="2">${isEdit ? plan.description || '' : ''}</textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="plan-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Save Plan'}</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#plan-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#plan-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const body = Object.fromEntries(formData.entries());
      if (!body.description) delete body.description;

      try {
        if (isEdit) {
          await api.patch(`${CONFIG.ENDPOINTS.WORKSPACE_PLANS}${plan.id}/`, body);
          toast.success('Plan updated successfully');
        } else {
          await api.post(CONFIG.ENDPOINTS.WORKSPACE_PLANS, body);
          toast.success('Plan created successfully');
        }
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};