/* ==========================================================================
   PIHUB Dashboard - Referral Codes page
   Staff only: CEO, LEAD_DEVELOPER (also 'LEAD DEVELOPER'), ADMIN.

   Endpoints
     GET    CONFIG.ENDPOINTS.REFERRAL_CODES            list (plain array)
     POST   CONFIG.ENDPOINTS.REFERRAL_CODES            create (code "" auto-generates)
     PATCH  CONFIG.ENDPOINTS.REFERRAL_CODES + '{id}/'  edit, activate, deactivate
     DELETE CONFIG.ENDPOINTS.REFERRAL_CODES + '{id}/'  delete
     GET    CONFIG.ENDPOINTS.REFERRAL_INFLUENCERS      influencer names and defaults
     GET    CONFIG.ENDPOINTS.COURSES                   applicable courses list
   ========================================================================== */

(function () {
  const S = window.referralShared;
  const EP = CONFIG.ENDPOINTS;
  const DASH = S.DASH;
  const FIELDS = [
    'influencer', 'code', 'discount_percent', 'commission_percent',
    'max_uses', 'expires_at', 'is_active', 'applicable_courses',
  ];

  let root = null;
  let rows = [];
  let influencerList = [];
  let courseList = [];
  let infMap = {};
  let courseMap = {};
  const lookupFailed = { courses: false, influencers: false };
  let lookupsReady = Promise.resolve();

  let loading = false;
  let acting = false;
  let reqId = 0;
  const filters = { influencer: '', is_active: '', search: '' };

  /* ---------- helpers ---------- */
  function q(selector) {
    return root ? root.querySelector(selector) : null;
  }

  function detailUrl(id) {
    return `${EP.REFERRAL_CODES}${encodeURIComponent(id)}/`;
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

  function idOf(value) {
    if (value && typeof value === 'object') return S.pick(value, 'id', 'pk');
    return value;
  }

  function influencerName(c) {
    if (c.influencer && typeof c.influencer === 'object') {
      const n = S.str(c.influencer.name);
      if (n) return n;
    }
    const id = idOf(c.influencer);
    if (id === undefined || id === null) return DASH;
    return S.str(c.influencer_name) || infMap[String(id)] || `Influencer #${id}`;
  }

  function courseIds(c) {
    const list = Array.isArray(c.applicable_courses) ? c.applicable_courses : [];
    return list.map(idOf).filter((x) => x !== undefined && x !== null);
  }

  function coursesLabel(c) {
    const ids = courseIds(c);
    if (!ids.length) return 'All courses';
    const names = ids.map((id) => courseMap[String(id)] || `Course #${id}`);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  }

  function isExpired(c) {
    if (typeof c.is_expired === 'boolean') return c.is_expired;
    if (!c.expires_at) return false;
    const t = new Date(c.expires_at).getTime();
    return !isNaN(t) && t < Date.now();
  }

  function isMaxed(c) {
    if (typeof c.is_maxed_out === 'boolean') return c.is_maxed_out;
    const max = S.toNumber(c.max_uses);
    const used = S.toNumber(c.times_used) || 0;
    return max !== null && used >= max;
  }

  function statusBadge(c) {
    if (c.is_active === false) return '<span class="badge badge-neutral">Inactive</span>';
    if (isExpired(c)) return '<span class="badge badge-danger">Expired</span>';
    if (isMaxed(c)) return '<span class="badge badge-warning">Maxed out</span>';
    return '<span class="badge badge-success">Active</span>';
  }

  function usageText(c) {
    const used = S.toNumber(c.times_used) || 0;
    const max = S.toNumber(c.max_uses);
    return `${used} / ${max === null ? 'unlimited' : max}`;
  }

  /* ---------- lookups ---------- */
  function loadLookups() {
    const infs = S.fetchAll(EP.REFERRAL_INFLUENCERS)
      .then((list) => {
        influencerList = list;
        infMap = {};
        list.forEach((i) => {
          if (i && i.id !== undefined && i.id !== null) {
            infMap[String(i.id)] = S.str(i.name) || `Influencer #${i.id}`;
          }
        });
      })
      .catch(() => { lookupFailed.influencers = true; });

    const courses = S.fetchAll(EP.COURSES, { page_size: 200 })
      .then((list) => {
        courseList = list;
        courseMap = {};
        list.forEach((c) => {
          if (c && c.id !== undefined && c.id !== null) {
            courseMap[String(c.id)] = S.str(c.title) || S.str(c.name) || `Course #${c.id}`;
          }
        });
      })
      .catch(() => { lookupFailed.courses = true; });

    return Promise.all([infs, courses]).then(populateFilterOptions);
  }

  function populateFilterOptions() {
    if (!root) return;
    const sel = q('#rc-influencer');
    if (sel) {
      sel.innerHTML = '<option value="">All influencers</option>' + influencerList
        .filter((i) => i && i.id !== undefined && i.id !== null)
        .map((i) => `<option value="${S.esc(i.id)}">${S.esc(infMap[String(i.id)])}</option>`)
        .join('');
      sel.value = filters.influencer;
    }
    const note = q('#rc-lookup-note');
    if (note) {
      const missing = [];
      if (lookupFailed.influencers) missing.push('influencer');
      if (lookupFailed.courses) missing.push('course');
      note.textContent = missing.length ? `The ${missing.join(' and ')} list could not be loaded.` : '';
    }
  }

  /* ---------- loading ---------- */
  async function load() {
    const token = ++reqId;
    loading = true;
    applyLocks();
    q('#rc-content').innerHTML = S.loadingHtml('Loading referral codes...');

    try {
      await lookupsReady;
      const params = {};
      if (filters.influencer) params.influencer = filters.influencer;
      if (filters.is_active) params.is_active = filters.is_active;
      if (filters.search) params.search = filters.search;
      const data = await api.get(EP.REFERRAL_CODES, params);
      if (token !== reqId) return;
      rows = S.asList(data);
      loading = false;
      renderTable();
      applyLocks();
    } catch (err) {
      if (token !== reqId) return;
      loading = false;
      rows = [];
      q('#rc-content').innerHTML = S.errorHtml(S.errMsg(err));
      applyLocks();
    }
  }

  /* ---------- table ---------- */
  function renderTable() {
    const content = q('#rc-content');
    if (!rows.length) {
      const filtered = !!(filters.influencer || filters.is_active || filters.search);
      content.innerHTML = S.emptyHtml(
        'No referral codes found',
        filtered ? 'No codes match the current filters.' : 'Click "Add Referral Code" to create the first one.'
      );
      return;
    }

    content.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Influencer</th>
              <th>Discount</th>
              <th>Commission</th>
              <th>Expires</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Courses</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((c) => {
              const id = S.esc(c.id);
              const code = S.str(c.code) || '';
              const active = c.is_active !== false;
              return `
              <tr>
                <td>
                  <div class="rf-code-cell">
                    <span class="rf-code">${S.esc(code || DASH)}</span>
                    ${code ? `<button type="button" class="btn btn-sm btn-secondary" data-act="copy" data-code="${S.esc(code)}">Copy</button>` : ''}
                  </div>
                </td>
                <td>${S.esc(influencerName(c))}</td>
                <td>${S.esc(S.percent(c.discount_percent))}</td>
                <td>${S.esc(S.percent(c.commission_percent))}</td>
                <td class="rf-nowrap">${c.expires_at ? S.esc(S.dateTime(c.expires_at)) : 'No expiry'}</td>
                <td class="rf-nowrap">${S.esc(usageText(c))}</td>
                <td>${statusBadge(c)}</td>
                <td>${S.esc(coursesLabel(c))}</td>
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
      </div>`;
  }

  /* ---------- copy ---------- */
  async function copyCode(code) {
    const ok = await S.copyText(code);
    if (ok) S.notifySuccess('Code copied.');
    else S.notifyError('Could not copy. Select the code and copy it manually.');
  }

  /* ---------- activate / deactivate ---------- */
  async function setActive(id, makeActive) {
    const row = findRow(id);
    if (!row) return;
    const label = S.str(row.code) || 'this code';

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
        S.notifySuccess(`${label} activated.`);
        await load();
      } catch (err) {
        S.notifyError(S.errMsg(err));
      }
      return;
    }

    const outcome = await S.confirmAction({
      title: 'Deactivate referral code',
      messages: [
        `Deactivate ${label}?`,
        'Students will no longer be able to use it. You can activate it again at any time.',
      ],
      confirmLabel: 'Deactivate',
      run: request,
    });
    if (!outcome) return;
    if (!outcome.ok) {
      S.notifyError(S.errMsg(outcome.error));
      return;
    }
    S.notifySuccess(`${label} deactivated.`);
    await load();
  }

  /* ---------- delete ---------- */
  async function deleteCode(id) {
    const row = findRow(id);
    if (!row) return;
    const label = S.str(row.code) || 'this code';

    const outcome = await S.confirmAction({
      title: 'Delete referral code',
      messages: [
        `Permanently delete ${label}?`,
        'This cannot be undone. If you only want to stop its use, deactivate it instead.',
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
        const canAlt = row.is_active !== false;
        S.blockedDialog({
          title: 'Cannot delete referral code',
          message: S.errMsg(err),
          hint: 'A code that has been used cannot be deleted. Deactivate it instead.',
          altLabel: canAlt ? 'Deactivate instead' : '',
          onAlt: canAlt ? () => setActive(row.id, false) : null,
        });
      } else {
        S.notifyError(S.errMsg(err));
      }
      return;
    }

    S.notifySuccess(`${label} deleted.`);
    await load();
  }

  /* ---------- generated code popup ---------- */
  function showGeneratedCode(code) {
    const m = S.modal({
      title: 'Referral code created',
      width: 440,
      bodyHtml: `
        <p class="rf-confirm-text">Give this code to the influencer. It is generated by the system.</p>
        <div class="rf-code-box">${S.esc(code)}</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-rf-close>Close</button>
          <button type="button" class="btn btn-primary" data-rf-copy>Copy code</button>
        </div>`,
    });
    m.overlay.addEventListener('click', async (e) => {
      if (e.target.closest('[data-rf-close]')) {
        m.close();
      } else if (e.target.closest('[data-rf-copy]')) {
        const btn = e.target.closest('[data-rf-copy]');
        const ok = await S.copyText(code);
        btn.textContent = ok ? 'Copied' : 'Copy failed';
      }
    });
  }

  /* ---------- create / edit modal ---------- */
  function formHtml(row) {
    const isEdit = !!row;
    const val = (key) => (isEdit && row[key] !== null && row[key] !== undefined ? row[key] : '');
    const selectedInf = isEdit ? idOf(row.influencer) : '';
    const selectedCourses = isEdit ? courseIds(row).map(String) : [];
    const active = isEdit ? row.is_active !== false : true;

    const infOptions = '<option value="">Select an influencer</option>' + influencerList
      .filter((i) => i && i.id !== undefined && i.id !== null)
      .map((i) => {
        const inactive = i.is_active === false ? ' (inactive)' : '';
        const sel = String(i.id) === String(selectedInf) ? 'selected' : '';
        return `<option value="${S.esc(i.id)}" ${sel}>${S.esc(infMap[String(i.id)])}${inactive}</option>`;
      })
      .join('');

    let coursesBlock;
    if (lookupFailed.courses) {
      coursesBlock = '<p class="rf-note">The course list could not be loaded. The current course selection will be left unchanged.</p>';
    } else if (!courseList.length) {
      coursesBlock = '<p class="rf-note">No courses found. The code will apply to all courses.</p>';
    } else {
      coursesBlock = `<div class="rf-check-list">${courseList
        .filter((c) => c && c.id !== undefined && c.id !== null)
        .map((c) => `
          <label class="rf-inline-check">
            <input type="checkbox" name="applicable_courses" value="${S.esc(c.id)}" ${selectedCourses.indexOf(String(c.id)) !== -1 ? 'checked' : ''} />
            <span>${S.esc(courseMap[String(c.id)])}</span>
          </label>`).join('')}</div>`;
    }

    return `
      <form class="rf-form" id="rc-form" novalidate>
        <div class="rf-form-error rf-hidden" data-form-error></div>

        <div class="form-group">
          <label class="form-label">Influencer <span class="rf-req">*</span></label>
          <select class="form-select" name="influencer">${infOptions}</select>
          ${lookupFailed.influencers ? '<div class="rf-hint">The influencer list could not be loaded.</div>' : ''}
          <div class="rf-field-error" data-error-for="influencer"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Code</label>
          <input class="form-input rf-code" name="code" maxlength="50" autocomplete="off"
            value="${S.esc(val('code'))}"
            ${isEdit ? 'readonly' : 'placeholder="Leave blank to auto-generate"'} />
          <div class="rf-hint">${isEdit ? 'The code cannot be changed after it is created.' : 'Leave blank and the system will generate a code for you.'}</div>
          <div class="rf-field-error" data-error-for="code"></div>
        </div>

        <div class="rf-form-grid">
          <div class="form-group">
            <label class="form-label">Discount (%) <span class="rf-req">*</span></label>
            <input class="form-input" type="number" name="discount_percent" min="0" max="100" step="0.01" value="${S.esc(val('discount_percent'))}" />
            <div class="rf-field-error" data-error-for="discount_percent"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Commission (%)</label>
            <input class="form-input" type="number" name="commission_percent" min="0" max="100" step="0.01" value="${S.esc(val('commission_percent'))}" />
            <div class="rf-hint" id="rc-commission-hint">Leave blank to use the influencer's default.</div>
            <div class="rf-field-error" data-error-for="commission_percent"></div>
          </div>
        </div>

        <div class="rf-form-grid">
          <div class="form-group">
            <label class="form-label">Expires at <span class="optional-tag">(optional)</span></label>
            <input class="form-input" type="datetime-local" name="expires_at" value="${S.esc(S.toDateTimeLocal(row && row.expires_at))}" />
            <div class="rf-field-error" data-error-for="expires_at"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Max uses <span class="optional-tag">(optional)</span></label>
            <input class="form-input" type="number" name="max_uses" min="1" step="1" placeholder="Unlimited" value="${S.esc(val('max_uses'))}" />
            <div class="rf-field-error" data-error-for="max_uses"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Applicable courses</label>
          ${coursesBlock}
          <div class="rf-hint">Select none to apply the code to all courses.</div>
          <div class="rf-field-error" data-error-for="applicable_courses"></div>
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
          <button type="submit" class="btn btn-primary" data-rf-save>${isEdit ? 'Save changes' : 'Create code'}</button>
        </div>
      </form>`;
  }

  function influencerDefault(idValue) {
    const inf = influencerList.find((i) => String(i.id) === String(idValue));
    return inf ? S.toNumber(inf.default_commission_percent) : null;
  }

  function openForm(row) {
    const isEdit = !!row;
    const m = S.modal({
      title: isEdit ? 'Edit referral code' : 'Add referral code',
      width: 600,
      bodyHtml: formHtml(row),
    });
    const form = m.overlay.querySelector('#rc-form');
    const saveLabel = isEdit ? 'Save changes' : 'Create code';
    const field = (name) => form.querySelector(`[name="${name}"]`);

    function refreshCommissionHint() {
      const d = influencerDefault(field('influencer').value);
      const hint = form.querySelector('#rc-commission-hint');
      hint.textContent = d === null
        ? "Leave blank to use the influencer's default."
        : `Leave blank to use the influencer's default (${S.percent(d)}).`;
    }
    field('influencer').addEventListener('change', refreshCommissionHint);
    refreshCommissionHint();

    form.querySelector('[data-rf-cancel]').addEventListener('click', () => {
      if (!m.locked) m.close();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errs = {};
      const read = (name) => field(name).value.trim();

      const influencer = read('influencer');
      const code = read('code');
      const discountRaw = read('discount_percent');
      const commissionRaw = read('commission_percent');
      const maxRaw = read('max_uses');
      const expiresRaw = read('expires_at');

      if (!influencer) errs.influencer = 'Select an influencer.';

      let discount = null;
      if (discountRaw === '') {
        errs.discount_percent = 'Discount is required.';
      } else {
        discount = S.toNumber(discountRaw);
        if (discount === null || discount < 0 || discount > 100) {
          errs.discount_percent = 'Enter a number between 0 and 100.';
        }
      }

      let commission = null;
      if (commissionRaw !== '') {
        commission = S.toNumber(commissionRaw);
        if (commission === null || commission < 0 || commission > 100) {
          errs.commission_percent = 'Enter a number between 0 and 100.';
        }
      } else {
        commission = influencerDefault(influencer);
      }

      let maxUses = null;
      if (maxRaw !== '') {
        maxUses = S.toNumber(maxRaw);
        if (maxUses === null || maxUses < 1 || Math.floor(maxUses) !== maxUses) {
          errs.max_uses = 'Enter a whole number of 1 or more, or leave blank for unlimited.';
        }
      }

      let expiresAt = null;
      if (expiresRaw !== '') {
        const d = new Date(expiresRaw);
        if (isNaN(d.getTime())) errs.expires_at = 'Enter a valid date and time.';
        else expiresAt = d.toISOString();
      }

      if (Object.keys(errs).length) {
        S.showFormErrors(form, { fields: errs, general: '' });
        return;
      }

      const body = {
        influencer: Number.isNaN(Number(influencer)) ? influencer : Number(influencer),
        discount_percent: discount,
        max_uses: maxUses,
        expires_at: expiresAt,
        is_active: field('is_active').checked,
      };
      if (commission !== null) body.commission_percent = commission;
      if (!isEdit) body.code = code;

      if (!lookupFailed.courses) {
        body.applicable_courses = Array.from(
          form.querySelectorAll('input[name="applicable_courses"]:checked')
        ).map((c) => (Number.isNaN(Number(c.value)) ? c.value : Number(c.value)));
      }

      S.clearFormErrors(form);
      S.setFormBusy(form, true);
      m.locked = true;
      setActing(true);
      try {
        let res;
        if (isEdit) res = await api.patch(detailUrl(row.id), body);
        else res = await api.post(EP.REFERRAL_CODES, body);

        m.locked = false;
        m.close();
        setActing(false);

        const generated = S.str(res && res.code);
        if (!isEdit && !code && generated) {
          showGeneratedCode(generated);
        } else {
          S.notifySuccess(isEdit ? 'Referral code updated.' : 'Referral code created.');
        }
        await load();
      } catch (err) {
        m.locked = false;
        setActing(false);
        S.setFormBusy(form, false, saveLabel);
        S.showFormErrors(form, S.parseFormErrors(err, FIELDS));
      }
    });

    const firstField = field('influencer');
    if (firstField) firstField.focus();
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

    if (btn.id === 'rc-add') return openForm(null);
    if (btn.id === 'rc-reset') {
      q('#rc-search').value = '';
      q('#rc-influencer').value = '';
      q('#rc-active').value = '';
      filters.search = '';
      filters.influencer = '';
      filters.is_active = '';
      return load();
    }

    const act = btn.dataset.act;
    if (!act) return;
    if (act === 'copy') copyCode(btn.dataset.code);
    else if (act === 'edit') {
      const row = findRow(btn.dataset.id);
      if (row) openForm(row);
    } else if (act === 'deactivate') setActive(btn.dataset.id, false);
    else if (act === 'activate') setActive(btn.dataset.id, true);
    else if (act === 'delete') deleteCode(btn.dataset.id);
  }

  function onChange(e) {
    const id = e.target.id;
    if (id === 'rc-influencer') {
      filters.influencer = e.target.value;
      load();
    } else if (id === 'rc-active') {
      filters.is_active = e.target.value;
      load();
    }
  }

  const onSearchInput = utils.debounce(() => {
    filters.search = q('#rc-search').value.trim();
    load();
  }, 400);

  function onInput(e) {
    if (e.target.id === 'rc-search') onSearchInput();
  }

  /* ---------- render ---------- */
  function render(container) {
    if (!S.ensureAccess(container)) return;
    S.injectStyles();

    root = container;
    rows = [];
    filters.influencer = '';
    filters.is_active = '';
    filters.search = '';

    container.innerHTML = `
      <div class="rf-page">
        <div class="rf-toolbar">
          <label class="rf-field rf-field-grow">
            <span>Search</span>
            <input type="text" class="form-input" id="rc-search" placeholder="Search code" />
          </label>
          <label class="rf-field">
            <span>Influencer</span>
            <select class="form-select" id="rc-influencer"><option value="">All influencers</option></select>
          </label>
          <label class="rf-field">
            <span>Status</span>
            <select class="form-select" id="rc-active">
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <div class="rf-actions">
            <button type="button" class="btn btn-secondary" id="rc-reset">Reset</button>
          </div>
          <div class="rf-toolbar-end">
            <button type="button" class="btn btn-primary" id="rc-add" data-lock>+ Add Referral Code</button>
          </div>
        </div>
        <p class="rf-note" id="rc-lookup-note"></p>
        <div id="rc-content"></div>
      </div>
    `;

    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('input', onInput);

    lookupsReady = loadLookups();
    load();
  }

  window.referralCodesPage = { render };
})();