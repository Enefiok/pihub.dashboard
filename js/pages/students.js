/* ==========================================================================
   PIHUB Dashboard — Students Page
   Tracks people actively studying at PIHUB via the dedicated Student model,
   independent of Certificate (which only proves completion).
   ========================================================================== */

window.studentsPage = {
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
        ${canWrite ? '<button class="btn btn-primary" id="add-student-btn">+ Add Student</button>' : ''}
      </div>
      <div class="table-wrapper">
        <div id="students-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    if (canWrite) {
      document.getElementById('add-student-btn').addEventListener('click', () => this.openModal());
    }
    await this.load();
  },

  async load() {
    const target = document.getElementById('students-table-container');
    try {
      const data = await api.get(CONFIG.ENDPOINTS.STUDENTS);
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load students</h3><p>${err.message}</p></div>`;
    }
  },

  renderTable() {
    const target = document.getElementById('students-table-container');
    const canWrite = this.canWrite();

    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No students found</h3><p>${canWrite ? 'Click "Add Student" the moment someone starts a course.' : 'Check back later.'}</p></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Course</th><th>Status</th><th>Enrolled</th>${canWrite ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>
          ${this.state.data.map(s => `
            <tr>
              <td>${s.name || '—'}</td>
              <td>${s.email || '—'}</td>
              <td>${s.phone || '—'}</td>
              <td>${s.course_title || '—'}</td>
              <td><span class="badge ${this.statusBadgeClass(s.status)}">${this.statusLabel(s.status)}</span></td>
              <td>${utils.formatDate(s.enrolled_date)}</td>
              ${canWrite ? `
                <td class="table-actions">
                  <button class="btn btn-sm btn-secondary edit-btn" data-id="${s.id}">Edit</button>
                  <button class="btn btn-sm btn-danger delete-btn" data-id="${s.id}">Delete</button>
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
        const student = this.state.data.find(s => s.id == btn.dataset.id);
        this.openModal(student);
      });
    });

    utils.qsa('.delete-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.deleteStudent(btn.dataset.id));
    });
  },

  statusLabel(value) {
    const map = { ACTIVE: 'Active', COMPLETED: 'Completed', DROPPED: 'Dropped Out' };
    return map[value] || value || '—';
  },

  statusBadgeClass(value) {
    const map = { ACTIVE: 'badge-success', COMPLETED: 'badge-info', DROPPED: 'badge-danger' };
    return map[value] || 'badge-neutral';
  },

  async deleteStudent(id) {
    if (!this.canWrite()) return; // extra guard; server enforces the real rule
    if (!confirm('Remove this student record? This cannot be undone.')) return;
    try {
      await api.delete(`${CONFIG.ENDPOINTS.STUDENTS}${id}/`);
      toast.success('Student removed');
      this.load();
    } catch (err) {
      toast.error(err.message);
    }
  },

  async openModal(student = null) {
    if (!this.canWrite()) return; // safety net — button shouldn't be reachable anyway

    const isEdit = !!student;

    let courseOptions = '<option value="">Loading courses...</option>';
    try {
      const data = await api.get(CONFIG.ENDPOINTS.COURSES);
      const courses = data.results || data || [];
      courseOptions = courses.map(c =>
        `<option value="${c.id}" ${isEdit && student.course == c.id ? 'selected' : ''}>${c.title}</option>`
      ).join('');
      if (!courseOptions) courseOptions = '<option value="">No courses available</option>';
    } catch {
      courseOptions = '<option value="">Couldn\'t load courses</option>';
    }

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>${isEdit ? 'Edit Student' : 'Add Student'}</h2><span class="modal-close">&times;</span></div>
          <form id="student-form">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input class="form-input" name="name" value="${isEdit ? student.name || '' : ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Email <span class="optional-tag">(optional)</span></label>
              <input class="form-input" type="email" name="email" value="${isEdit ? student.email || '' : ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Phone <span class="optional-tag">(optional)</span></label>
              <input class="form-input" name="phone" value="${isEdit ? student.phone || '' : ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Course</label>
              <select class="form-select" name="course">${courseOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" name="status">
                <option value="ACTIVE" ${isEdit && student.status === 'ACTIVE' ? 'selected' : ''}>Active</option>
                <option value="COMPLETED" ${isEdit && student.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                <option value="DROPPED" ${isEdit && student.status === 'DROPPED' ? 'selected' : ''}>Dropped Out</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Notes <span class="optional-tag">(optional)</span></label>
              <textarea class="form-textarea" name="notes" rows="2">${isEdit ? student.notes || '' : ''}</textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="student-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Student'}</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#student-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#student-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const body = Object.fromEntries(formData.entries());
      if (!body.email) delete body.email;
      if (!body.notes) delete body.notes;
      if (!body.course) delete body.course;

      try {
        if (isEdit) {
          await api.patch(`${CONFIG.ENDPOINTS.STUDENTS}${student.id}/`, body);
          toast.success('Student updated');
        } else {
          await api.post(CONFIG.ENDPOINTS.STUDENTS, body);
          toast.success('Student added');
        }
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};