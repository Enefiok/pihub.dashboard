/* ==========================================================================
   PIHUB Dashboard - Influencers page
   Staff only: CEO, LEAD_DEVELOPER (also 'LEAD DEVELOPER'), ADMIN.

   Endpoints
     GET    CONFIG.ENDPOINTS.REFERRAL_INFLUENCERS            list (plain array)
     POST   CONFIG.ENDPOINTS.REFERRAL_INFLUENCERS            create
     PATCH  CONFIG.ENDPOINTS.REFERRAL_INFLUENCERS + '{id}/'  edit, activate, deactivate
     DELETE CONFIG.ENDPOINTS.REFERRAL_INFLUENCERS + '{id}/'  hard delete (fails if codes exist)
   ========================================================================== */

(function () {
  const S = window.referralShared;
  const EP = CONFIG.ENDPOINTS;
  const DASH = S.DASH;
  const FIELDS = ['name', 'email', 'phone', 'social_handle', 'default_commission_percent', 'is_active'];

  let root = null;
  let rows = [];
  let loading = false;
  let acting = false;
  let reqId = 0;
  let page = 1;
  const PAGE_SIZE = 5;
  const filters = { search: '', is_active: '' };

  function q(selector) {
    return root ? root.querySelector(selector) : null;
  }

  function detailUrl(id) {
    return `${EP.REFERRAL_INFLUENCERS}${encodeURIComponent(id)}/`;
  }

  function applyLocks() {
    if (!root) return;
    const busy = loading || acting;
    root.querySelectorAll('[data-lock]').forEach((b) => { b.disabled = busy; });
  }

  function setActing(value) {
    acting = value;
    applyLocks();
  }

  function findRow(id) {
    return rows.find((r) => String(r.id) === String(id));
  }

  /* ---------- loading ---------- */
  async function load() {
    const token = ++reqId;
    loading = true;
    applyLocks();
    q('#inf-content').innerHTML = S.loadingHtml('Loading influencers...');

    try {
      const params = { ordering: 'name' };
      if (filters.search) params.search = filters.search;
      if (filters.is_active) params.is_active = filters.is_active;
      const data = await api.get(EP.REFERRAL_INFLUENCERS, params);
      if (token !== reqId) return;
      rows = S.asList(data);
      loading = false;
      renderTable();
      applyLocks();
    } catch (err) {
      if (token !== reqId) return;
      loading = false;
      rows = [];
      q('#inf-content').innerHTML = S.errorHtml(S.errMsg(err));
      applyLocks();
    }
  }

  /* ---------- table ---------- */
  function renderTable() {
    const content = q('#inf-content');
    if (!rows.length) {
      const filtered = !!(filters.search || filters.is_active);
      content.innerHTML = S.emptyHtml(
        'No influencers found',
        filtered ? 'No influencers match the current filters.' : 'Click "Add Influencer" to create the first one.'
      );
      return;
    }

    // Pagination: show only PAGE_SIZE influencers at a time
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, page), totalPages);
    const startIdx = (page - 1) * PAGE_SIZE;
    const pageItems = rows.slice(startIdx, startIdx + PAGE_SIZE);
    const rangeStart = startIdx + 1;
    const rangeEnd = startIdx + pageItems.length;

    content.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Social handle</th>
              <th>Default commission</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map((r) => {
              const id = S.esc(r.id);
              const active = r.is_active !== false;
              return `
              <tr>
                <td>${S.esc(S.str(r.name) || DASH)}</td>
                <td>${S.esc(S.str(r.email) || DASH)}</td>
                <td>${S.esc(S.str(r.phone) || DASH)}</td>
                <td>${S.esc(S.str(r.social_handle) || DASH)}</td>
                <td>${S.esc(S.percent(r.default_commission_percent))}</td>
                <td><span class="badge ${active ? 'badge-success' : 'badge-neutral'}">${active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <div class="table-actions" style="flex-wrap:wrap;">
                    <button type="button" class="btn btn-sm btn-secondary" data-act="edit" data-id="${id}" data-lock>Edit</button>
                    <button type="button" class="btn btn-sm btn-secondary" data-act="${active ? 'deactivate' : 'activate'}" data-id="${id}" data-lock>${active ? 'Deactivate' : 'Activate'}</button>
                    <button type="button" class="btn btn-sm btn-danger" data-act="delete" data-id="${id}" data-lock>Delete</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="table-pagination">
          <span class="table-pagination-info">${rangeStart}–${rangeEnd} of ${total}</span>
          <div class="table-pagination-controls">
            <button type="button" class="btn btn-sm btn-secondary" data-act="page-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
            <button type="button" class="btn btn-sm btn-secondary" data-act="page-next" ${page >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </div>`;
  }

  /* ---------- activate / deactivate ---------- */
  async function setActive(id, makeActive) {
    const row = findRow(id);
    if (!row) return;
    const who = S.str(row.name) || 'this influencer';

    const request = async () => {
      setActing(true);
      try {
        return await api.patch(detailUrl(row.id), { is_active: makeActive });
      } finally {
        setActing(false);
      }
    };

    if (makeActive) {
      try {
        await request();
        S.notifySuccess(`${who} activated.`);
        await load();
      } catch (err) {
        S.notifyError(S.errMsg(err));
      }
      return;
    }

    const outcome = await S.confirmAction({
      title: 'Deactivate influencer',
      messages: [
        `Deactivate ${who}?`,
        'Their record and codes are kept. You can activate them again at any time.',
      ],
      confirmLabel: 'Deactivate',
      run: request,
    });
    if (!outcome) return;
    if (!outcome.ok) {
      S.notifyError(S.errMsg(outcome.error));
      return;
    }
    S.notifySuccess(`${who} deactivated.`);
    await load();
  }

  /* ---------- delete ---------- */
  async function deleteInfluencer(id) {
    const row = findRow(id);
    if (!row) return;
    const who = S.str(row.name) || 'this influencer';

    const outcome = await S.confirmAction({
      title: 'Delete influencer',
      messages: [
        `Permanently delete ${who}?`,
        'This cannot be undone. If you only want to stop using them, deactivate instead.',
      ],
      confirmLabel: 'Delete',
      danger: true,
      run: async () => {
        setActing(true);
        try {
          return await api.delete(detailUrl(row.id));
        } finally {
          setActing(false);
        }
      },
    });

    if (!outcome) return;

    if (!outcome.ok) {
      const err = outcome.error;
      if (err && (err.status === 400 || err.status === 409)) {
        S.blockedDialog({
          title: 'Cannot delete influencer',
          message: S.errMsg(err),
          hint: 'An influencer that has referral codes cannot be deleted. Deactivate them instead.',
          altLabel: row.is_active === false ? '' : 'Deactivate instead',
          onAlt: row.is_active === false ? null : () => setActive(row.id, false),
        });
      } else {
        S.notifyError(S.errMsg(err));
      }
      return;
    }

    S.notifySuccess(`${who} deleted.`);
    await load();
  }

  /* ---------- create / edit modal ---------- */
  function formHtml(row) {
    const isEdit = !!row;
    const v = (key) => S.esc(isEdit && row[key] !== null && row[key] !== undefined ? row[key] : '');
    const active = isEdit ? row.is_active !== false : true;

    return `
      <form class="rf-form" id="inf-form" novalidate>
        <div class="rf-form-error rf-hidden" data-form-error></div>

        <div class="form-group">
          <label class="form-label">Name <span class="rf-req">*</span></label>
          <input class="form-input" name="name" maxlength="150" value="${v('name')}" />
          <div class="rf-field-error" data-error-for="name"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Email <span class="rf-req">*</span></label>
          <input class="form-input" type="email" name="email" value="${v('email')}" />
          <div class="rf-field-error" data-error-for="email"></div>
        </div>

        <div class="rf-form-grid">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-input" name="phone" value="${v('phone')}" />
            <div class="rf-field-error" data-error-for="phone"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Social handle</label>
            <input class="form-input" name="social_handle" placeholder="@handle" value="${v('social_handle')}" />
            <div class="rf-field-error" data-error-for="social_handle"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Default commission (%)</label>
          <input class="form-input" type="number" name="default_commission_percent" min="0" max="100" step="0.01" value="${v('default_commission_percent')}" />
          <div class="rf-hint">Between 0 and 100. Used for new codes when no commission is set.</div>
          <div class="rf-field-error" data-error-for="default_commission_percent"></div>
        </div>

        <div class="form-group">
          <label class="rf-inline-check">
            <input type="checkbox" name="is_active" ${active ? 'checked' : ''} />
            <span>Active</span>
          </label>
          <div class="rf-field-error" data-error-for="is_active"></div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-rf-cancel>Cancel</button>
          <button type="submit" class="btn btn-primary" data-rf-save>${isEdit ? 'Save changes' : 'Create influencer'}</button>
        </div>
      </form>`;
  }

  function openForm(row) {
    const isEdit = !!row;
    const m = S.modal({
      title: isEdit ? 'Edit influencer' : 'Add influencer',
      width: 560,
      bodyHtml: formHtml(row),
    });
    const form = m.overlay.querySelector('#inf-form');
    const saveLabel = isEdit ? 'Save changes' : 'Create influencer';

    form.querySelector('[data-rf-cancel]').addEventListener('click', () => {
      if (!m.locked) m.close();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = (name) => form.querySelector(`[name="${name}"]`).value.trim();
      const errs = {};

      const name = val('name');
      const email = val('email');
      const commissionRaw = val('default_commission_percent');
      let commission = null;

      if (!name) errs.name = 'Name is required.';
      if (!email) errs.email = 'Email is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address.';
      if (commissionRaw !== '') {
        commission = S.toNumber(commissionRaw);
        if (commission === null || commission < 0 || commission > 100) {
          errs.default_commission_percent = 'Enter a number between 0 and 100.';
        }
      }

      if (Object.keys(errs).length) {
        S.showFormErrors(form, { fields: errs, general: '' });
        return;
      }

      const body = {
        name,
        email,
        phone: val('phone'),
        social_handle: val('social_handle'),
        is_active: form.querySelector('[name="is_active"]').checked,
      };
      if (commission !== null) body.default_commission_percent = commission;

      S.clearFormErrors(form);
      S.setFormBusy(form, true);
      m.locked = true;
      setActing(true);
      try {
        if (isEdit) await api.patch(detailUrl(row.id), body);
        else await api.post(EP.REFERRAL_INFLUENCERS, body);
        m.locked = false;
        m.close();
        S.notifySuccess(isEdit ? 'Influencer updated.' : 'Influencer created.');
        setActing(false);
        await load();
      } catch (err) {
        m.locked = false;
        setActing(false);
        S.setFormBusy(form, false, saveLabel);
        S.showFormErrors(form, S.parseFormErrors(err, FIELDS));
      }
    });

    const first = form.querySelector('[name="name"]');
    if (first) first.focus();
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const t = e.target;
    if (t.closest('[data-rf-retry]')) {
      load();
      return;
    }
    const btn = t.closest('button');
    if (!btn || !root.contains(btn) || btn.disabled) return;

    if (btn.id === 'inf-add') return openForm(null);
    if (btn.id === 'inf-reset') {
      q('#inf-search').value = '';
      q('#inf-active').value = '';
      filters.search = '';
      filters.is_active = '';
      page = 1;
      return load();
    }

    const act = btn.dataset.act;
    if (!act) return;
    if (act === 'edit') {
      const row = findRow(btn.dataset.id);
      if (row) openForm(row);
    } else if (act === 'deactivate') setActive(btn.dataset.id, false);
    else if (act === 'activate') setActive(btn.dataset.id, true);
    else if (act === 'delete') deleteInfluencer(btn.dataset.id);
    else if (act === 'page-prev' || act === 'page-next') {
      page += act === 'page-next' ? 1 : -1;
      renderTable();
      applyLocks(); // re-apply busy lock to the freshly rendered action buttons
    }
  }

  function onChange(e) {
    if (e.target.id === 'inf-active') {
      filters.is_active = e.target.value;
      page = 1;
      load();
    }
  }

  const onSearchInput = utils.debounce(() => {
    filters.search = q('#inf-search').value.trim();
    page = 1;
    load();
  }, 400);

  function onInput(e) {
    if (e.target.id === 'inf-search') onSearchInput();
  }

  /* ---------- render ---------- */
  function render(container) {
    if (!S.ensureAccess(container)) return;
    S.injectStyles();

    root = container;
    rows = [];
    page = 1;
    filters.search = '';
    filters.is_active = '';

    container.innerHTML = `
      <div class="rf-page">
        <div class="rf-toolbar">
          <label class="rf-field rf-field-grow">
            <span>Search</span>
            <input type="text" class="form-input" id="inf-search" placeholder="Search name or email" />
          </label>
          <label class="rf-field">
            <span>Status</span>
            <select class="form-select" id="inf-active">
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <div class="rf-actions">
            <button type="button" class="btn btn-secondary" id="inf-reset">Reset</button>
          </div>
          <div class="rf-toolbar-end">
            <button type="button" class="btn btn-primary" id="inf-add" data-lock>+ Add Influencer</button>
          </div>
        </div>
        <div id="inf-content"></div>
      </div>
    `;

    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('input', onInput);

    load();
  }

  window.influencersPage = { render };
})();