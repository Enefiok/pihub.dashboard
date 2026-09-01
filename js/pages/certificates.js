/* ==========================================================================
   PIHUB Dashboard — Certificates Page
   ========================================================================== */

window.certificatesPage = {
  state: { data: [], courses: [] },

  // ASSUMPTION: no permission class for certificates was provided.
  // Defaulting to IsManagementOrReadOnly's rule (the "default policy for
  // most modules" per its docstring). Confirm certificates/views.py
  // permission_classes and adjust MANAGEMENT_ROLES if it differs
  // (e.g. if Instructors can issue certs for their own courses).
  MANAGEMENT_ROLES: ['CEO', 'LEAD_DEVELOPER', 'ADMIN'],

  canIssue() {
    return auth.hasRole(...this.MANAGEMENT_ROLES);
  },

  async render(container) {
    const canIssue = this.canIssue();

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:var(--space-4);">
        <div></div>
        ${canIssue ? '<button class="btn btn-primary" id="add-cert-btn">+ Issue New Certificate</button>' : ''}
      </div>
      <div class="table-wrapper">
        <div id="certs-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    if (canIssue) {
      document.getElementById('add-cert-btn').addEventListener('click', () => this.openModal());
    }
    await this.load();
  },

  async load() {
    const target = document.getElementById('certs-table-container');
    try {
      // NOTE: "list all certificates" endpoint isn't explicitly in the
      // Postman doc (only verify-by-UUID is confirmed). Assuming
      // CONFIG.ENDPOINTS.CERTIFICATES ('/api/certificates/') lists for staff —
      // confirm with backend dev if this 404s.
      const data = await api.get(CONFIG.ENDPOINTS.CERTIFICATES);
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load certificates</h3><p>${err.message}</p></div>`;
    }
  },

  renderTable() {
    const target = document.getElementById('certs-table-container');
    const canIssue = this.canIssue();

    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No certificates issued yet</h3><p>${canIssue ? 'Click "Issue New Certificate" to get started.' : 'Check back later.'}</p></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Cert ID</th><th>Student</th><th>Email</th><th>Course</th><th>Issue Date</th><th>Issued By</th></tr></thead>
        <tbody>
          ${this.state.data.map(c => `
            <tr>
              <td style="font-family:monospace;font-size:var(--font-size-xs);">${(c.certificate_id || '').toString().slice(0, 8)}...</td>
              <td>${c.student_name || '—'}</td>
              <td>${c.student_email || '—'}</td>
              <td>${c.course_title || c.course || '—'}</td>
              <td>${utils.formatDate(c.issue_date || c.created_at)}</td>
              <td>${c.issued_by_name || c.issued_by || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async openModal() {
    if (!this.canIssue()) return; // safety net — button shouldn't be reachable anyway

    // Fetch courses for the dropdown
    let courseOptions = '<option value="">Loading courses...</option>';
    try {
      const data = await api.get(CONFIG.ENDPOINTS.COURSES);
      const courses = data.results || data || [];
      courseOptions = courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    } catch {
      courseOptions = '<option value="">Couldn\'t load courses</option>';
    }

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>Issue New Certificate</h2><span class="modal-close">&times;</span></div>
          <form id="cert-form">
            <div class="form-group">
              <label class="form-label">Student Name</label>
              <input class="form-input" name="student_name" required />
            </div>
            <div class="form-group">
              <label class="form-label">Student Email</label>
              <input class="form-input" type="email" name="student_email" required />
            </div>
            <div class="form-group">
              <label class="form-label">Course</label>
              <select class="form-select" name="course" required>${courseOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Issue Date</label>
              <input class="form-input" type="date" name="issue_date" required />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="cert-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">Issue Certificate</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#cert-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#cert-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const body = Object.fromEntries(formData.entries());
      try {
        await api.post(CONFIG.ENDPOINTS.CERTIFICATES, body);
        toast.success('Certificate issued successfully');
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};