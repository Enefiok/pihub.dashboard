/* ==========================================================================
   PIHUB Dashboard — Gallery Page
   ========================================================================== */

window.galleryPage = {
  state: { data: [] },

  // Mirrors backend accounts/permissions.py -> IsMarketerOrManagement
  WRITE_ROLES: ['CEO', 'LEAD_DEVELOPER', 'ADMIN', 'MARKETER'],

  canWrite() {
    return auth.hasRole(...this.WRITE_ROLES);
  },

  async render(container) {
    const canWrite = this.canWrite();

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:var(--space-4);">
        <div></div>
        ${canWrite ? '<button class="btn btn-primary" id="add-image-btn">+ Upload Image</button>' : ''}
      </div>
      <div id="gallery-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-4);">
        ${Array.from({ length: 4 }).map(() => `<div class="skeleton" style="height:140px;border-radius:12px;"></div>`).join('')}
      </div>
    `;

    if (canWrite) {
      document.getElementById('add-image-btn').addEventListener('click', () => this.openModal());
    }
    await this.load();
  },

  async load() {
    const target = document.getElementById('gallery-grid');
    try {
      const data = await api.get(CONFIG.ENDPOINTS.GALLERY_STAFF);
      this.state.data = data.results || data || [];
      this.renderGrid();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load gallery</h3><p>${err.message}</p></div>`;
    }
  },

  renderGrid() {
    const target = document.getElementById('gallery-grid');
    const canWrite = this.canWrite();

    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No images yet</h3><p>${canWrite ? 'Click "Upload Image" to add your first one.' : 'Check back later.'}</p></div>`;
      return;
    }

    target.innerHTML = this.state.data.map(img => `
      <div class="card" style="padding:0;overflow:hidden;">
        <img src="${img.image}" style="width:100%;height:120px;object-fit:cover;" />
        <div style="padding:var(--space-3);">
          <div style="font-size:var(--font-size-sm);font-weight:600;">${img.title || '—'}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2);">
            <span class="badge badge-neutral">${this.categoryLabel(img.category)}</span>
            <span class="badge ${img.is_active ? 'badge-success' : 'badge-neutral'}">${img.is_active ? 'Active' : 'Hidden'}</span>
          </div>
          ${canWrite ? `
            <div style="display:flex;gap:var(--space-2);margin-top:var(--space-3);">
              <button class="btn btn-sm btn-secondary edit-btn" data-id="${img.id}" style="flex:1;">Edit</button>
              <button class="btn btn-sm btn-danger delete-btn" data-id="${img.id}" style="flex:1;">Delete</button>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    if (!canWrite) return;

    utils.qsa('.edit-btn', target).forEach(btn => {
      btn.addEventListener('click', () => {
        const image = this.state.data.find(i => i.id == btn.dataset.id);
        this.openModal(image);
      });
    });

    utils.qsa('.delete-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.deleteImage(btn.dataset.id));
    });
  },

  categoryLabel(value) {
    const map = {
      HOME_CAROUSEL: 'Home Carousel',
      WORKSPACE: 'Workspace',
      PODCAST: 'Podcast Studio',
      EVENTS: 'Events',
    };
    return map[value] || value || '—';
  },

  async deleteImage(id) {
    if (!this.canWrite()) return; // extra guard; server enforces the real rule
    if (!confirm('Delete this image? This cannot be undone.')) return;
    try {
      await api.delete(`${CONFIG.ENDPOINTS.GALLERY_STAFF}${id}/`);
      toast.success('Image deleted');
      this.load();
    } catch (err) {
      toast.error(err.message);
    }
  },

  openModal(image = null) {
    if (!this.canWrite()) return; // safety net — button shouldn't be reachable anyway

    const isEdit = !!image;

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>${isEdit ? 'Edit Image' : 'Upload Gallery Image'}</h2><span class="modal-close">&times;</span></div>
          <form id="gallery-form">
            <div class="form-group">
              <label class="form-label">Title</label>
              <input class="form-input" name="title" value="${isEdit ? image.title || '' : ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-select" name="category" required>
                <option value="HOME_CAROUSEL" ${isEdit && image.category === 'HOME_CAROUSEL' ? 'selected' : ''}>Home Carousel</option>
                <option value="WORKSPACE" ${isEdit && image.category === 'WORKSPACE' ? 'selected' : ''}>Workspace</option>
                <option value="PODCAST" ${isEdit && image.category === 'PODCAST' ? 'selected' : ''}>Podcast Studio</option>
                <option value="EVENTS" ${isEdit && image.category === 'EVENTS' ? 'selected' : ''}>Events</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Display Order</label>
              <input class="form-input" type="number" name="display_order" value="${isEdit ? image.display_order : 1}" />
            </div>
            <div class="form-group">
              <label class="form-label">Image ${isEdit ? '<span class="optional-tag">(leave blank to keep current)</span>' : ''}</label>
              <input class="form-input" type="file" name="image" accept="image/*" ${isEdit ? '' : 'required'} />
            </div>
            <div class="form-group">
              <label class="form-label" style="display:flex;align-items:center;gap:var(--space-2);">
                <input type="checkbox" name="is_active" ${!isEdit || image.is_active ? 'checked' : ''} style="width:auto;" /> Active
              </label>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="gallery-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Upload'}</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#gallery-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#gallery-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      formData.set('is_active', formData.get('is_active') === 'on' ? 'true' : 'false');

      const imageFile = formData.get('image');
      if (!imageFile || imageFile.size === 0) formData.delete('image');

      try {
        if (isEdit) {
          await api.patch(`${CONFIG.ENDPOINTS.GALLERY_STAFF}${image.id}/`, formData, true);
          toast.success('Image updated successfully');
        } else {
          await api.post(CONFIG.ENDPOINTS.GALLERY_STAFF, formData, true);
          toast.success('Image uploaded successfully');
        }
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};