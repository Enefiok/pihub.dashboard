/* ==========================================================================
   PIHUB Dashboard — Blog Posts Page
   ========================================================================== */

window.blogPage = {
  state: { data: [], categories: [] },
  quillInstance: null,

  // Mirrors backend accounts/permissions.py -> IsMarketerOrManagement
  BLOG_WRITE_ROLES: ['CEO', 'LEAD_DEVELOPER', 'ADMIN', 'MARKETER'],

  canWrite() {
    return auth.hasRole(...this.BLOG_WRITE_ROLES);
  },

  async render(container) {
    const canWrite = this.canWrite();

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:var(--space-4);">
        <div></div>
        ${canWrite ? '<button class="btn btn-primary" id="add-post-btn">+ New Post</button>' : ''}
      </div>
      <div class="table-wrapper">
        <div id="blog-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    if (canWrite) {
      document.getElementById('add-post-btn').addEventListener('click', () => this.openModal());
    }
    await this.load();
  },

  async load() {
    const target = document.getElementById('blog-table-container');
    try {
      const data = await api.get(CONFIG.ENDPOINTS.BLOG_POSTS_STAFF);
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load posts</h3><p>${err.message}</p></div>`;
    }
  },

  renderTable() {
    const target = document.getElementById('blog-table-container');
    const canWrite = this.canWrite();

    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No blog posts yet</h3><p>${canWrite ? 'Click "New Post" to publish your first one.' : 'Check back later.'}</p></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Status</th><th>Slug</th>${canWrite ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>
          ${this.state.data.map(p => `
            <tr>
              <td>${p.title || '—'}</td>
              <td>${p.author_name || '—'}</td>
              <td>${p.category_name || '—'}</td>
              <td><span class="badge ${utils.badgeClassForStatus(p.status)}">${p.status || '—'}</span></td>
              <td style="font-family:monospace;font-size:var(--font-size-xs);">${p.slug || '—'}</td>
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
        const post = this.state.data.find(p => p.id == btn.dataset.id);
        this.openModal(post);
      });
    });

    utils.qsa('.delete-btn', target).forEach(btn => {
      btn.addEventListener('click', () => this.deletePost(btn.dataset.id));
    });
  },

  async deletePost(id) {
    if (!this.canWrite()) return; // extra guard; server enforces the real rule
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api.delete(`${CONFIG.ENDPOINTS.BLOG_POSTS_STAFF}${id}/`);
      toast.success('Post deleted');
      this.load();
    } catch (err) {
      toast.error(err.message);
    }
  },

  // Shared toolbar markup with hover tooltips via title attributes.
  // Reused identically by newsletters.js and courses.js for consistency.
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

  async openModal(post = null) {
    if (!this.canWrite()) return; // safety net — button shouldn't be reachable anyway

    const isEdit = !!post;

    let categoryOptions = '<option value="">No categories yet</option>';
    try {
      const data = await api.get(CONFIG.ENDPOINTS.BLOG_CATEGORIES_STAFF);
      const cats = data.results || data || [];
      if (cats.length) {
        categoryOptions = cats.map(c =>
          `<option value="${c.id}" ${isEdit && post.category == c.id ? 'selected' : ''}>${c.name}</option>`
        ).join('');
      }
    } catch { /* leave default option */ }

    const overlay = utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>${isEdit ? 'Edit Post' : 'New Blog Post'}</h2><span class="modal-close">&times;</span></div>
          <form id="post-form">
            <div class="form-group">
              <label class="form-label">Title</label>
              <input class="form-input" name="title" value="${isEdit ? post.title || '' : ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select class="form-select" name="category">${categoryOptions}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Content</label>
              ${this.quillToolbarHtml('post-toolbar')}
              <div id="post-editor" style="background:#fff;"></div>
            </div>
            <div class="form-group">
              <label class="form-label">Featured Image <span class="optional-tag">${isEdit ? '(leave blank to keep current)' : '(optional)'}</span></label>
              <input class="form-input" type="file" name="featured_image" accept="image/*" />
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select class="form-select" name="status">
                <option value="DRAFT" ${isEdit && post.status === 'DRAFT' ? 'selected' : ''}>Draft</option>
                <option value="PUBLISHED" ${isEdit && post.status === 'PUBLISHED' ? 'selected' : ''}>Published</option>
              </select>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="post-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Save Post'}</button>
            </div>
          </form>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);

    // Initialize Quill against our custom tooltip-labeled toolbar
    this.quillInstance = new Quill('#post-editor', {
      theme: 'snow',
      placeholder: 'Write your post content...',
      modules: {
        toolbar: '#post-toolbar',
      },
    });

    if (isEdit && post.content) {
      this.quillInstance.root.innerHTML = post.content;
    }

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#post-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#post-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      const htmlContent = this.quillInstance.root.innerHTML;
      formData.append('content', htmlContent);

      const imageFile = formData.get('featured_image');
      if (!imageFile || imageFile.size === 0) formData.delete('featured_image');

      try {
        if (isEdit) {
          await api.patch(`${CONFIG.ENDPOINTS.BLOG_POSTS_STAFF}${post.id}/`, formData, true);
          toast.success('Post updated successfully');
        } else {
          await api.post(CONFIG.ENDPOINTS.BLOG_POSTS_STAFF, formData, true);
          toast.success('Post saved successfully');
        }
        overlay.remove();
        this.load();
      } catch (err) {
        toast.error(err.message);
      }
    });
  },
};