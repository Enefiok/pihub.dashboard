/* ==========================================================================
   PIHUB Dashboard — Courses Page
   ========================================================================== */

window.coursesPage = {
  state: { data: [] },
  quillInstance: null,

  // ASSUMPTION: no permission class for Courses was provided.
  // Defaulting to IsManagementOrReadOnly's rule (the "default policy for
  // most modules" per its docstring). Confirm courses/views.py
  // permission_classes and adjust MANAGEMENT_ROLES if it differs
  // (e.g. if Instructors should get some access here too).
  MANAGEMENT_ROLES: ['CEO', 'LEAD_DEVELOPER', 'ADMIN'],

  canWrite() {
    return auth.hasRole(...this.MANAGEMENT_ROLES);
  },

  async render(container) {
    const canWrite = this.canWrite();

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:var(--space-4);">
        <div></div>
        ${canWrite ? '<button class="btn btn-primary" id="add-course-btn">+ Add New Course</button>' : ''}
      </div>
      <div class="table-wrapper">
        <div id="courses-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    if (canWrite) {
      document.getElementById('add-course-btn').addEventListener('click', () => this.openModal());
    }
    await this.load();
  },

  async load() {
    const target = document.getElementById('courses-table-container');
    try {
      const data = await api.get(CONFIG.ENDPOINTS.COURSES);
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load courses</h3><p>${err.message}</p></div>`;
    }
  },

  renderTable() {
    const target = document.getElementById('courses-table-container');
    const canWrite = this.canWrite();

    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No courses found</h3><p>${canWrite ? 'Click "Add New Course" to get started.' : 'Check back later.'}</p></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Title</th><th>Duration</th><th>Status</th><th>Requirements</th><th>Image</th>${canWrite ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>
          ${this.state.data.map(c => `
            <tr>
              <td>${c.title || '—'}</td>
              <td>${c.duration || '—'}</td>
              <td><span class="badge ${utils.badgeClassForStatus(c.status)}">${c.status || '—'}</span></td>
              <td>${c.requirements ? 'Yes' : 'No'}</td>
              <td>${c.image ? `<img src="${c.image}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;" />` : '—'}</td>
              ${canWrite ? `
                <td class="table-actions">
                  <button class="btn btn-sm btn-secondary edit-btn" data-id="${c.id}">Edit</button>
                  <button class="btn btn-sm btn-danger delete-btn" data-id="${c.id}">Delete</button>
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
        const course = this.state.data.find(c => c.id == btn.dataset.id);
        this.openModal(course);
      });
    });

    utils.qsa('.delete-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.deleteCourse(btn.dataset.id));
    });
  },

  async deleteCourse(id) {
    if (!this.canWrite()) return; // extra guard; server enforces the real rule
    if (!confirm('Delete this course? This cannot be undone.')) return;
    try {
      await api.delete(`${CONFIG.ENDPOINTS.COURSES}${id}/`);
      toast.success('Course deleted');
      this.load();
    } catch (err) {
      toast.error(err.message);
    }
  },

  // Shared tooltip-labeled toolbar markup (same pattern as blog.js)
  quillToolbarHtml(toolbarId) {
    return `
      <div id="${toolbarId}">
        <span class="ql-formats">
          <button class="ql-bold" title="Bold"></button>
          <button class="ql-italic" title="Italic"></button>
          <button class="ql-underline" title="Underline"></button>
          <button class="ql-strike" title="Strikethrough"></button>
        </span>
        <span class="ql-formats">
          <select class="ql-header" title="Heading size">
            <option value="1"></option>
            <option value="2"></option>
            <option value="3"></option>
            <option selected></option>
          </select>
        </span>
        <span class="ql-formats">
          <button class="ql-list" value="ordered" title="Numbered list"></button>
          <button class="ql-list" value="bullet" title="Bullet list"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-link" title="Insert link"></button>
          <button class="ql-image" title="Insert image"></button>
        </span>
        <span class="ql-formats">
          <button class="ql-clean" title="Clear formatting"></button>
        </span>
      </div>
    `;
  },

  openModal(course = null) {
    if (!this.canWrite()) return; // safety net — button shouldn't be reachable anyway

    const isEdit = !!course;

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>${isEdit ? 'Edit Course' : 'Add New Course'}</h2><span class="modal-close">&times;</span></div>
          <form id="course-form">
            <div class="form-group">
              <label class="form-label">Title</label>
              <input class="form-input" name="title" value="${isEdit ? course.title || '' : ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              ${this.quillToolbarHtml('course-toolbar')}
              <div id="course-editor" style="background:#fff;"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Duration <span class="optional-tag">e.g. "8 month"</span></label>
              <input class="form-input" name="duration" value="${isEdit ? course.duration || '' : ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Requirements <span class="optional-tag">(optional)</span></label>
              <textarea class="form-textarea" name="requirements" rows="2">${isEdit ? course.requirements || '' : ''}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Image <span class="optional-tag">${isEdit ? '(leave blank to keep current image)' : '(optional)'}</span></label>
              <input class="form-input" type="file" name="image" accept="image/*" />
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" name="status">
                <option value="ACTIVE" ${isEdit && course.status === 'ACTIVE' ? 'selected' : ''}>Active</option>
                <option value="UNAVAILABLE" ${isEdit && course.status === 'UNAVAILABLE' ? 'selected' : ''}>Unavailable</option>
                <option value="COMING_SOON" ${isEdit && course.status === 'COMING_SOON' ? 'selected' : ''}>Coming Soon</option>
              </select>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="course-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Save Course'}</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    this.quillInstance = new Quill('#course-editor', {
      theme: 'snow',
      placeholder: 'Write the course description...',
      modules: {
        toolbar: '#course-toolbar',
      },
    });

    if (isEdit && course.description) {
      this.quillInstance.root.innerHTML = course.description;
    }

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#course-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#course-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      const descriptionHtml = this.quillInstance.root.innerHTML;
      const isEmptyDescription = this.quillInstance.getText().trim().length === 0;
      if (!isEmptyDescription) {
        formData.append('description', descriptionHtml);
      }

      if (!formData.get('requirements')) formData.delete('requirements');
      const imageFile = formData.get('image');
      if (!imageFile || imageFile.size === 0) formData.delete('image');

      try {
        if (isEdit) {
          await api.patch(`${CONFIG.ENDPOINTS.COURSES}${course.id}/`, formData, true);
          toast.success('Course updated successfully');
        } else {
          await api.post(CONFIG.ENDPOINTS.COURSES, formData, true);
          toast.success('Course created successfully');
        }
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};