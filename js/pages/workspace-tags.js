/* ==========================================================================
   PIHUB Dashboard — Workspace Tags Page
   ========================================================================== */

window.workspaceTagsPage = {
  state: { data: [] },

  async render(container) {
    container.innerHTML = `
      <div class="page-header" style="margin-bottom:var(--space-4);">
        <div></div>
        <button class="btn btn-primary" id="add-tag-btn">+ Add New Tag</button>
      </div>
      <div class="table-wrapper">
        <div id="tags-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    document.getElementById('add-tag-btn').addEventListener('click', () => this.openModal());
    await this.load();
  },

  async load() {
    const target = document.getElementById('tags-table-container');
    try {
      const data = await api.get(CONFIG.ENDPOINTS.WORKSPACE_TAGS);
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load tags</h3><p>${err.message}</p></div>`;
    }
  },

  renderTable() {
    const target = document.getElementById('tags-table-container');
    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No tags found</h3><p>Click "Add New Tag" to create your first physical workspace tag.</p></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Tag Code</th><th>Status</th><th>Held By</th><th>Actions</th></tr></thead>
        <tbody>
          ${this.state.data.map(t => `
            <tr>
              <td style="font-family:monospace;">${t.tag_code || '—'}</td>
              <td><span class="badge ${t.is_available ? 'badge-success' : 'badge-warning'}">${t.is_available ? 'Available' : 'In Use'}</span></td>
              <td>${t.booking_customer_name || '—'}</td>
              <td class="table-actions">
                ${!t.is_available
                  ? `<button class="btn btn-sm btn-secondary release-btn" data-id="${t.id}" data-tag="${t.tag_code}" data-customer="${t.booking_customer_name || 'this customer'}">Force Release</button>`
                  : `<button class="btn btn-sm btn-danger delete-btn" data-id="${t.id}" data-tag="${t.tag_code}">Delete</button>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    utils.qsa('.release-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.confirmRelease(btn.dataset.id, btn.dataset.tag, btn.dataset.customer));
    });
    utils.qsa('.delete-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.confirmDelete(btn.dataset.id, btn.dataset.tag));
    });
  },

  confirmRelease(id, tagCode, customerName) {
    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal" style="width:400px;">
          <div class="modal-header"><h2>Release this tag?</h2><span class="modal-close">&times;</span></div>
          <p>Are you sure "<strong>${customerName}</strong>" is done with tag <strong>${tagCode}</strong>? This will make it available for the next customer.</p>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="release-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="release-confirm">Yes, Release</button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#release-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#release-confirm').addEventListener('click', async () => {
      try {
        await api.patch(`${CONFIG.ENDPOINTS.WORKSPACE_TAGS}${id}/`, { is_available: true, current_booking: null });
        toast.success('Tag released');
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },

  confirmDelete(id, tagCode) {
    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal" style="width:400px;">
          <div class="modal-header"><h2>Delete this tag?</h2><span class="modal-close">&times;</span></div>
          <p>Permanently delete tag <strong>${tagCode}</strong>? Only do this if the physical badge is lost or destroyed — this cannot be undone.</p>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="delete-cancel">Cancel</button>
            <button type="button" class="btn btn-danger" id="delete-confirm">Yes, Delete</button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#delete-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#delete-confirm').addEventListener('click', async () => {
      try {
        await api.delete(`${CONFIG.ENDPOINTS.WORKSPACE_TAGS}${id}/`);
        toast.success('Tag deleted');
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },

  openModal() {
    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>Add New Tag</h2><span class="modal-close">&times;</span></div>
          <form id="tag-form">
            <div class="form-group">
              <label class="form-label">Tag Code</label>
              <input class="form-input" name="tag_code" placeholder="e.g. PIHUB-001" required />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="tag-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Tag</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#tag-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#tag-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const body = Object.fromEntries(formData.entries());
      try {
        await api.post(CONFIG.ENDPOINTS.WORKSPACE_TAGS, body);
        toast.success('Tag created successfully');
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};