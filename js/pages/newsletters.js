/* ==========================================================================
   PIHUB Dashboard — Newsletters Page
   NOTE: Edit/Delete only available for drafts. Once sent, a newsletter is
   a permanent record of what subscribers received — it can't be edited or
   deleted after the fact.
   ========================================================================== */

window.newslettersPage = {
  state: { data: [] },
  quillInstance: null,

  // Mirrors backend accounts/permissions.py -> IsMarketerOrManagement
  // (assumed — same permission class as blog/gallery; confirm with backend if newsletters differ)
  WRITE_ROLES: ['CEO', 'LEAD_DEVELOPER', 'ADMIN', 'MARKETER'],

  canWrite() {
    return auth.hasRole(...this.WRITE_ROLES);
  },

  async render(container) {
    const canWrite = this.canWrite();

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:var(--space-4);">
        <div></div>
        ${canWrite ? '<button class="btn btn-primary" id="compose-btn">+ Compose Newsletter</button>' : ''}
      </div>
      <div class="table-wrapper">
        <div id="newsletters-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    if (canWrite) {
      document.getElementById('compose-btn').addEventListener('click', () => this.openModal());
    }
    await this.load();
  },

  async load() {
    const target = document.getElementById('newsletters-table-container');
    try {
      const data = await api.get(CONFIG.ENDPOINTS.NEWSLETTERS);
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load newsletters</h3><p>${err.message}</p></div>`;
    }
  },

  renderTable() {
    const target = document.getElementById('newsletters-table-container');
    const canWrite = this.canWrite();

    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No newsletters yet</h3><p>${canWrite ? 'Click "Compose Newsletter" to draft your first one.' : 'Check back later.'}</p></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Subject</th><th>Status</th><th>Sent Date</th><th>Created</th>${canWrite ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>
          ${this.state.data.map(n => `
            <tr data-id="${n.id}">
              <td>${n.subject || '—'}</td>
              <td><span class="badge ${n.is_sent ? 'badge-success' : 'badge-neutral'}">${n.is_sent ? 'Sent' : 'Draft'}</span></td>
              <td>${n.sent_at ? utils.formatDateTime(n.sent_at) : '—'}</td>
              <td>${utils.formatDate(n.created_at)}</td>
              ${canWrite ? `
                <td class="table-actions">
                  ${!n.is_sent ? `
                    <button class="btn btn-sm btn-secondary edit-btn" data-id="${n.id}">Edit</button>
                    <button class="btn btn-sm btn-primary send-btn" data-id="${n.id}" data-subject="${n.subject || ''}">Send</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${n.id}">Delete</button>
                  ` : '—'}
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
        const newsletter = this.state.data.find(n => n.id == btn.dataset.id);
        this.openModal(newsletter);
      });
    });
    utils.qsa('.send-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.confirmSend(btn.dataset.id, btn.dataset.subject));
    });
    utils.qsa('.delete-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.deleteNewsletter(btn.dataset.id));
    });
  },

  async deleteNewsletter(id) {
    if (!this.canWrite()) return; // extra guard; server enforces the real rule
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    try {
      await api.delete(`${CONFIG.ENDPOINTS.NEWSLETTERS}${id}/`);
      toast.success('Draft deleted');
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

  openModal(newsletter = null) {
    if (!this.canWrite()) return; // safety net — button shouldn't be reachable anyway

    const isEdit = !!newsletter;

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>${isEdit ? 'Edit Draft' : 'Compose Newsletter'}</h2><span class="modal-close">&times;</span></div>
          <form id="newsletter-form">
            <div class="form-group">
              <label class="form-label">Subject</label>
              <input class="form-input" name="subject" value="${isEdit ? newsletter.subject || '' : ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Content</label>
              ${this.quillToolbarHtml('newsletter-toolbar')}
              <div id="newsletter-editor" style="background:#fff;"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="newsletter-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Save as Draft'}</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    this.quillInstance = new Quill('#newsletter-editor', {
      theme: 'snow',
      placeholder: 'Write your newsletter content...',
      modules: {
        toolbar: '#newsletter-toolbar',
      },
    });

    if (isEdit && newsletter.content) {
      this.quillInstance.root.innerHTML = newsletter.content;
    }

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#newsletter-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#newsletter-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const body = Object.fromEntries(formData.entries());
      body.content = this.quillInstance.root.innerHTML;

      try {
        if (isEdit) {
          await api.patch(`${CONFIG.ENDPOINTS.NEWSLETTERS}${newsletter.id}/`, body);
          toast.success('Draft updated');
        } else {
          await api.post(CONFIG.ENDPOINTS.NEWSLETTERS, body);
          toast.success('Newsletter saved as draft');
        }
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },

  confirmSend(id, subject) {
    if (!this.canWrite()) return; // safety net — button shouldn't be reachable anyway

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal" style="width:400px;">
          <div class="modal-header"><h2>Send Newsletter?</h2><span class="modal-close">&times;</span></div>
          <p>Are you sure you want to send "<strong>${subject}</strong>" to all active subscribers? This action cannot be undone.</p>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="send-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="send-confirm">Yes, Send</button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#send-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#send-confirm').addEventListener('click', async () => {
      try {
        await api.post(`${CONFIG.ENDPOINTS.NEWSLETTERS}${id}/send/`, {});
        toast.success('Newsletter sent successfully');
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};