/* ==========================================================================
   PIHUB Dashboard - Registrations page
   Staff only: CEO, LEAD_DEVELOPER (also 'LEAD DEVELOPER'), ADMIN.

   Endpoints used
     GET   CONFIG.ENDPOINTS.REFERRAL_REGISTRATIONS              list (plain array or paginated)
     GET   CONFIG.ENDPOINTS.REFERRAL_REGISTRATIONS + '{id}/'    detail
     PATCH CONFIG.ENDPOINTS.REFERRAL_REGISTRATIONS + '{id}/status/'   { status: 'paid' | 'cancelled' }
     POST  CONFIG.ENDPOINTS.REFERRAL_REGISTRATION_ACTION        { action: 'mark_paid' | 'mark_cancelled', ids: [] }
     GET   CONFIG.ENDPOINTS.COURSES, REFERRAL_INFLUENCERS       filter options + course title lookup

   Row shape is normalised (see normaliseRegistration) so these variants work:
     course:        integer id | { id, title } | course_title (+ title lookup from /api/courses/)
     referral code: code_used | referral_code, as a string or { code, ... }
     missing values render as a dash.

   Status rules in the UI: only pending rows can change (to paid or cancelled).
   Checkboxes and action buttons appear on pending rows only.
   ========================================================================== */

(function () {
  const S = window.referralShared;
  const EP = CONFIG.ENDPOINTS;
  const DASH = S.DASH;

  /* ---------- state ---------- */
  let root = null;
  let courseMap = {};
  let courseList = [];
  let influencerList = [];
  const lookupFailed = { courses: false, influencers: false };
  let lookupsReady = Promise.resolve();

  let rows = [];
  let total = 0;
  let page = 1;
  let effectiveSize = CONFIG.PAGE_SIZE;
  let hasNext = false;
  let hasPrev = false;
  let loading = false;
  let acting = false;
  let reqId = 0;
  let selected = new Set(); // string ids of selected pending rows

  const filters = { search: '', course: '', status: '', influencer: '', start_date: '', end_date: '' };

  /* ---------- normaliser ---------- */
  function normaliseRegistration(raw, courses) {
    const r = raw && typeof raw === 'object' ? raw : {};

    const courseObj = r.course && typeof r.course === 'object' ? r.course : null;
    const courseId = courseObj ? S.pick(courseObj, 'id', 'pk') : S.pick(r, 'course', 'course_id');
    let courseTitle = S.str(courseObj ? S.pick(courseObj, 'title', 'name') : null) || S.str(r.course_title);
    if (!courseTitle && courseId !== undefined && courses) courseTitle = courses[String(courseId)] || null;
    if (!courseTitle && courseId !== undefined) courseTitle = `Course #${courseId}`;

    const codeRaw = S.pick(r, 'code_used', 'referral_code');
    const codeObj = codeRaw && typeof codeRaw === 'object' ? codeRaw : null;
    const code = S.str(codeObj ? codeObj.code : codeRaw);

    const inflObj = r.influencer && typeof r.influencer === 'object' ? r.influencer : null;
    const codeInfl = codeObj && codeObj.influencer && typeof codeObj.influencer === 'object' ? codeObj.influencer : null;
    const influencerName =
      S.str(r.influencer_name) ||
      S.str(codeObj && codeObj.influencer_name) ||
      S.str(codeInfl && codeInfl.name) ||
      S.str(inflObj && inflObj.name);

    const status = S.str(r.status);

    return {
      id: r.id !== undefined && r.id !== null ? r.id : null,
      fullName: S.str(S.pick(r, 'full_name', 'name')),
      email: S.str(r.email),
      phone: S.str(r.phone),
      courseId: courseId !== undefined ? courseId : null,
      courseTitle,
      code,
      influencerName,
      paymentOption: S.str(r.payment_option),
      status: status ? status.toLowerCase() : null,
      originalPrice: S.toNumber(r.original_price),
      discountAmount: S.toNumber(r.discount_amount),
      finalPrice: S.toNumber(r.final_price),
      commissionAmount: S.toNumber(r.commission_amount),
      createdAt: S.str(r.created_at),
      paidAt: S.str(r.paid_at),
    };
  }

  // Detail values win over list values, but only when they are present.
  function mergeRegistration(base, detail) {
    const out = Object.assign({}, base);
    Object.keys(detail).forEach((k) => {
      if (detail[k] !== null && detail[k] !== undefined) out[k] = detail[k];
    });
    return out;
  }

  function paymentLabel(value) {
    if (!value) return DASH;
    if (value === 'pay_now') return 'Pay now';
    if (value === 'pay_later') return 'Pay later';
    const s = value.replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function isPending(r) {
    return r.status === 'pending' && r.id !== null;
  }

  /* ---------- small DOM helpers ---------- */
  function q(selector) {
    return root ? root.querySelector(selector) : null;
  }

  function hasActiveFilters() {
    return Object.keys(filters).some((k) => !!filters[k]);
  }

  function applyLocks() {
    if (!root) return;
    const busy = loading || acting;
    root.querySelectorAll('[data-lock]').forEach((b) => {
      const needs = b.dataset.needs;
      b.disabled = busy || (needs === 'prev' && !hasPrev) || (needs === 'next' && !hasNext);
    });
  }

  function setActing(value) {
    acting = value;
    applyLocks();
  }

  /* ---------- lookups (courses, influencers) ---------- */
  function loadLookups() {
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

    const influencers = S.fetchAll(EP.REFERRAL_INFLUENCERS)
      .then((list) => { influencerList = list; })
      .catch(() => { lookupFailed.influencers = true; });

    return Promise.all([courses, influencers]).then(populateFilterOptions);
  }

  function populateFilterOptions() {
    if (!root) return;
    const courseSel = q('#rg-course');
    const inflSel = q('#rg-influencer');
    if (courseSel) {
      courseSel.innerHTML = '<option value="">All courses</option>' + courseList
        .filter((c) => c && c.id !== undefined && c.id !== null)
        .map((c) => `<option value="${S.esc(c.id)}">${S.esc(courseMap[String(c.id)])}</option>`)
        .join('');
      courseSel.value = filters.course;
    }
    if (inflSel) {
      inflSel.innerHTML = '<option value="">All influencers</option>' + influencerList
        .filter((i) => i && i.id !== undefined && i.id !== null)
        .map((i) => `<option value="${S.esc(i.id)}">${S.esc(S.str(i.name) || `Influencer #${i.id}`)}</option>`)
        .join('');
      inflSel.value = filters.influencer;
    }
    const note = q('#rg-lookup-note');
    if (note) {
      const missing = [];
      if (lookupFailed.courses) missing.push('course');
      if (lookupFailed.influencers) missing.push('influencer');
      note.textContent = missing.length
        ? `The ${missing.join(' and ')} filter list could not be loaded.`
        : '';
    }
  }

  /* ---------- list loading ---------- */
  function buildParams() {
    const p = { page, page_size: CONFIG.PAGE_SIZE };
    Object.keys(filters).forEach((k) => { if (filters[k]) p[k] = filters[k]; });
    return p;
  }

  async function load() {
    const token = ++reqId;
    loading = true;
    selected.clear();
    q('#rg-content').innerHTML = S.loadingHtml('Loading registrations...');
    q('#rg-pagination').classList.add('rf-hidden');
    updateBulkBar();
    applyLocks();

    try {
      await lookupsReady;

      let data;
      try {
        data = await api.get(EP.REFERRAL_REGISTRATIONS, buildParams());
      } catch (err) {
        // Out-of-range page (for example after filters shrank the list): retry from page 1.
        if (err && err.status === 404 && page > 1) {
          page = 1;
          data = await api.get(EP.REFERRAL_REGISTRATIONS, buildParams());
        } else {
          throw err;
        }
      }
      if (token !== reqId) return;

      const list = S.asList(data).map((r) => normaliseRegistration(r, courseMap));

      if (S.isPaginated(data)) {
        const count = S.toNumber(data.count);
        total = count === null ? list.length : count;
        hasNext = !!data.next;
        hasPrev = !!data.previous;
        if (page === 1 && data.next && list.length) effectiveSize = list.length;
        else if (page === 1 && !data.next) effectiveSize = CONFIG.PAGE_SIZE;
        rows = list;
      } else {
        // Plain array: page it on the client.
        effectiveSize = CONFIG.PAGE_SIZE;
        total = list.length;
        const start = (page - 1) * effectiveSize;
        rows = list.slice(start, start + effectiveSize);
        hasPrev = page > 1;
        hasNext = start + effectiveSize < total;
      }

      loading = false;
      renderTable();
      renderPagination();
      updateBulkBar();
      applyLocks();
    } catch (err) {
      if (token !== reqId) return;
      loading = false;
      rows = [];
      total = 0;
      hasNext = false;
      hasPrev = false;
      q('#rg-content').innerHTML = S.errorHtml(S.errMsg(err));
      q('#rg-pagination').classList.add('rf-hidden');
      updateBulkBar();
      applyLocks();
    }
  }

  function reload() {
    selected.clear();
    return load();
  }

  /* ---------- rendering ---------- */
  function rowHtml(r) {
    const id = r.id === null ? '' : String(r.id);
    const pending = isPending(r);
    const actions = `
      <div class="rf-actions">
        <button type="button" class="btn btn-secondary rf-btn-sm" data-act="view" data-id="${S.esc(id)}" data-lock>View</button>
        ${pending ? `
          <button type="button" class="btn btn-primary rf-btn-sm" data-act="paid" data-id="${S.esc(id)}" data-lock>Mark paid</button>
          <button type="button" class="btn rf-danger rf-btn-sm" data-act="cancelled" data-id="${S.esc(id)}" data-lock>Mark cancelled</button>
        ` : ''}
      </div>`;

    return `
      <tr class="${id ? 'rf-clickable' : ''}" data-id="${S.esc(id)}">
        <td>${pending ? `<input type="checkbox" class="rg-check" data-id="${S.esc(id)}" aria-label="Select registration" ${selected.has(id) ? 'checked' : ''} />` : ''}</td>
        <td>
          <div>${S.esc(r.fullName || DASH)}</div>
          <div class="rf-muted">${S.esc(r.email || DASH)}</div>
        </td>
        <td>${S.esc(r.courseTitle || DASH)}</td>
        <td>
          <div>${S.esc(r.code || DASH)}</div>
          ${r.influencerName ? `<div class="rf-muted">${S.esc(r.influencerName)}</div>` : ''}
        </td>
        <td class="rf-nowrap">${S.esc(paymentLabel(r.paymentOption))}</td>
        <td>${S.statusBadge(r.status)}</td>
        <td class="rf-num">${S.esc(S.money(r.finalPrice))}</td>
        <td class="rf-nowrap">${S.esc(S.date(r.createdAt))}</td>
        <td>${actions}</td>
      </tr>`;
  }

  function renderTable() {
    const content = q('#rg-content');
    if (!rows.length) {
      content.innerHTML = S.emptyHtml(
        'No registrations found',
        hasActiveFilters()
          ? 'No registrations match the current filters.'
          : 'Registrations will appear here once students sign up.'
      );
      return;
    }

    const pendingCount = rows.filter(isPending).length;
    content.innerHTML = `
      <div class="rf-table-wrap">
        <table class="rf-table">
          <thead>
            <tr>
              <th style="width:36px;">${pendingCount ? '<input type="checkbox" id="rg-check-all" aria-label="Select all pending registrations on this page" />' : ''}</th>
              <th>Student</th>
              <th>Course</th>
              <th>Code</th>
              <th>Payment</th>
              <th>Status</th>
              <th class="rf-num">Final price</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows.map(rowHtml).join('')}</tbody>
        </table>
      </div>`;
  }

  function renderPagination() {
    const el = q('#rg-pagination');
    if (!rows.length) {
      el.classList.add('rf-hidden');
      return;
    }
    const from = (page - 1) * effectiveSize + 1;
    const to = from + rows.length - 1;
    const pages = Math.max(1, Math.ceil(total / effectiveSize));
    el.innerHTML = `
      <span>Showing ${S.esc(S.num(from))} to ${S.esc(S.num(to))} of ${S.esc(S.num(total))}</span>
      <div class="rf-actions">
        <button type="button" class="btn btn-secondary rf-btn-sm" data-page-dir="prev" data-needs="prev" data-lock>Previous</button>
        <span style="align-self:center;">Page ${page} of ${pages}</span>
        <button type="button" class="btn btn-secondary rf-btn-sm" data-page-dir="next" data-needs="next" data-lock>Next</button>
      </div>`;
    el.classList.remove('rf-hidden');
  }

  function updateBulkBar() {
    const bar = q('#rg-bulkbar');
    if (!bar) return;
    const n = selected.size;
    bar.classList.toggle('rf-hidden', n === 0);
    q('#rg-bulk-count').textContent = `${n} selected`;
    const all = q('#rg-check-all');
    if (all) {
      const pending = rows.filter(isPending).length;
      all.checked = pending > 0 && n === pending;
      all.indeterminate = n > 0 && n < pending;
    }
  }

  /* ---------- filters ---------- */
  function readFilters() {
    filters.search = q('#rg-search').value.trim();
    filters.course = q('#rg-course').value;
    filters.status = q('#rg-status').value;
    filters.influencer = q('#rg-influencer').value;
    filters.start_date = q('#rg-start').value;
    filters.end_date = q('#rg-end').value;
  }

  function applyFilters() {
    readFilters();
    if (filters.start_date && filters.end_date && filters.start_date > filters.end_date) {
      S.notifyError('The start date must be on or before the end date.');
      return;
    }
    page = 1;
    load();
  }

  function resetFilters() {
    q('#rg-search').value = '';
    q('#rg-course').value = '';
    q('#rg-status').value = '';
    q('#rg-influencer').value = '';
    q('#rg-start').value = '';
    q('#rg-end').value = '';
    readFilters();
    page = 1;
    load();
  }

  function goPage(dir) {
    if (dir === 'prev' && hasPrev) page = Math.max(1, page - 1);
    else if (dir === 'next' && hasNext) page += 1;
    else return;
    load();
  }

  /* ---------- status changes ---------- */
  function handleActionError(err, single) {
    if (err && (err.status === 404 || err.status === 405)) {
      S.notifyError(single
        ? 'This action is not available yet, or the registration no longer exists.'
        : 'This action is not available yet.');
    } else {
      S.notifyError(S.errMsg(err));
    }
  }

  async function changeStatus(idStr, status, detailHandle) {
    const row = rows.find((r) => String(r.id) === String(idStr));
    if (!row || !isPending(row)) return;

    const paid = status === 'paid';
    const who = row.fullName || 'this student';
    const outcome = await S.confirmAction({
      title: paid ? 'Mark registration as paid' : 'Mark registration as cancelled',
      messages: [
        `Mark the registration for ${who} as ${paid ? 'paid' : 'cancelled'}?`,
        'This cannot be undone. Paid and cancelled registrations cannot be changed again.',
      ],
      confirmLabel: paid ? 'Mark as paid' : 'Mark as cancelled',
      danger: !paid,
      run: async () => {
        setActing(true);
        try {
          return await api.patch(`${EP.REFERRAL_REGISTRATIONS}${encodeURIComponent(row.id)}/status/`, { status });
        } finally {
          setActing(false);
        }
      },
    });

    if (!outcome) return;

    if (!outcome.ok) {
      handleActionError(outcome.error, true);
      // The list may be stale (for example the status was already changed elsewhere).
      if (outcome.error && [400, 404, 409].includes(outcome.error.status)) {
        if (detailHandle) detailHandle.close();
        await reload();
      }
      return;
    }

    const message = S.str(outcome.result && outcome.result.message);
    S.notifySuccess(message || `Registration marked as ${paid ? 'paid' : 'cancelled'}.`);
    if (detailHandle) detailHandle.close();
    await reload();
  }

  async function runBulk(action) {
    const ids = rows
      .filter((r) => isPending(r) && selected.has(String(r.id)))
      .map((r) => r.id);
    if (!ids.length) return;

    const paid = action === 'mark_paid';
    const n = ids.length;
    const outcome = await S.confirmAction({
      title: paid ? 'Mark selected as paid' : 'Mark selected as cancelled',
      messages: [
        `${n} pending registration${n === 1 ? '' : 's'} will be marked as ${paid ? 'paid' : 'cancelled'}.`,
        'This cannot be undone. Paid and cancelled registrations cannot be changed again.',
      ],
      confirmLabel: paid ? 'Mark as paid' : 'Mark as cancelled',
      danger: !paid,
      run: async () => {
        setActing(true);
        try {
          return await api.post(EP.REFERRAL_REGISTRATION_ACTION, { action, ids });
        } finally {
          setActing(false);
        }
      },
    });

    if (!outcome) return;

    if (!outcome.ok) {
      handleActionError(outcome.error, false);
      if (outcome.error && outcome.error.status === 400) await reload();
      return;
    }

    const res = outcome.result || {};
    const count = S.toNumber(res.count);
    if (count !== null && count < n) {
      const skipped = Array.isArray(res.skipped) ? res.skipped.length : n - count;
      S.notifySuccess(`${count} of ${n} registrations updated, ${skipped} skipped.`);
    } else {
      const message = S.str(res.message);
      S.notifySuccess(message || `${count === null ? n : count} registration${n === 1 ? '' : 's'} updated.`);
    }
    await reload();
  }

  function clearSelection() {
    selected.clear();
    root.querySelectorAll('.rg-check').forEach((c) => { c.checked = false; });
    updateBulkBar();
  }

  /* ---------- detail modal ---------- */
  function detailHtml(r, note) {
    const item = (label, html) =>
      `<div class="rf-detail-item"><dt>${label}</dt><dd>${html}</dd></div>`;
    const id = r.id === null ? '' : String(r.id);
    const pending = isPending(r);

    return `
      <dl class="rf-detail-grid">
        ${item('Student', S.esc(r.fullName || DASH))}
        ${item('Email', S.esc(r.email || DASH))}
        ${item('Phone', S.esc(r.phone || DASH))}
        ${item('Course', S.esc(r.courseTitle || DASH))}
        ${item('Referral code', S.esc(r.code || DASH))}
        ${item('Influencer', S.esc(r.influencerName || DASH))}
        ${item('Payment option', S.esc(paymentLabel(r.paymentOption)))}
        ${item('Status', S.statusBadge(r.status))}
        ${item('Original price', S.esc(S.money(r.originalPrice)))}
        ${item('Discount', S.esc(S.money(r.discountAmount)))}
        ${item('Final price', S.esc(S.money(r.finalPrice)))}
        ${item('Commission', S.esc(S.money(r.commissionAmount)))}
        ${item('Registered', S.esc(S.dateTime(r.createdAt)))}
        ${item('Paid at', S.esc(S.dateTime(r.paidAt)))}
      </dl>
      ${note ? `<p class="rf-note">${S.esc(note)}</p>` : ''}
      <div class="modal-footer">
        ${pending ? `
          <button type="button" class="btn btn-primary" data-act="paid" data-id="${S.esc(id)}">Mark paid</button>
          <button type="button" class="btn rf-danger" data-act="cancelled" data-id="${S.esc(id)}">Mark cancelled</button>
        ` : ''}
        <button type="button" class="btn btn-secondary" data-rf-close>Close</button>
      </div>`;
  }

  async function openDetail(idStr) {
    let current = rows.find((r) => String(r.id) === String(idStr));
    if (!current || current.id === null) return;

    const m = S.modal({
      title: 'Registration details',
      width: 660,
      bodyHtml: detailHtml(current, 'Loading latest details...'),
    });

    m.overlay.addEventListener('click', (e) => {
      if (e.target.closest('[data-rf-close]')) {
        m.close();
        return;
      }
      const btn = e.target.closest('[data-act]');
      if (btn && !btn.disabled) changeStatus(current.id, btn.dataset.act, m);
    });

    try {
      const raw = await api.get(`${EP.REFERRAL_REGISTRATIONS}${encodeURIComponent(current.id)}/`);
      current = mergeRegistration(current, normaliseRegistration(raw, courseMap));
      if (!m.closed) m.setBody(detailHtml(current, ''));
    } catch (err) {
      if (!m.closed) {
        m.setBody(detailHtml(current, `Could not load the latest details, showing the list data. ${S.errMsg(err)}`));
      }
    }
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const t = e.target;

    if (t.closest('[data-rf-retry]')) {
      reload();
      return;
    }

    const btn = t.closest('button');
    if (btn && root.contains(btn)) {
      if (btn.disabled) return;
      if (btn.id === 'rg-reset') return resetFilters();
      if (btn.id === 'rg-refresh') return reload();
      if (btn.hasAttribute('data-page-dir')) return goPage(btn.dataset.pageDir);
      if (btn.hasAttribute('data-bulk')) return runBulk(btn.dataset.bulk);
      if (btn.hasAttribute('data-bulk-clear')) return clearSelection();
      if (btn.dataset.act) {
        if (btn.dataset.act === 'view') return openDetail(btn.dataset.id);
        return changeStatus(btn.dataset.id, btn.dataset.act);
      }
      return;
    }

    const tr = t.closest('tr[data-id]');
    if (tr && tr.dataset.id && !t.closest('input, a, label')) openDetail(tr.dataset.id);
  }

  function onChange(e) {
    const t = e.target;

    if (t.id === 'rg-check-all') {
      selected.clear();
      root.querySelectorAll('.rg-check').forEach((c) => {
        c.checked = t.checked;
        if (t.checked) selected.add(c.dataset.id);
      });
      updateBulkBar();
      return;
    }

    if (t.classList && t.classList.contains('rg-check')) {
      if (t.checked) selected.add(t.dataset.id);
      else selected.delete(t.dataset.id);
      updateBulkBar();
      return;
    }

    if (['rg-course', 'rg-status', 'rg-influencer', 'rg-start', 'rg-end'].includes(t.id)) {
      applyFilters();
    }
  }

  const onSearchInput = utils.debounce(() => applyFilters(), 400);

  function onInput(e) {
    if (e.target.id === 'rg-search') onSearchInput();
  }

  /* ---------- render ---------- */
  function render(container) {
    if (!S.ensureAccess(container)) return;
    S.injectStyles();

    root = container;
    rows = [];
    total = 0;
    page = 1;
    selected = new Set();
    Object.keys(filters).forEach((k) => { filters[k] = ''; });

    container.innerHTML = `
      <div class="rf-page">
        <div class="rf-toolbar">
          <label class="rf-field rf-field-grow">
            <span>Search</span>
            <input type="text" class="form-input" id="rg-search" placeholder="Search name or email" />
          </label>
          <label class="rf-field">
            <span>Course</span>
            <select class="form-input" id="rg-course"><option value="">All courses</option></select>
          </label>
          <label class="rf-field">
            <span>Status</span>
            <select class="form-input" id="rg-status">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label class="rf-field">
            <span>Influencer</span>
            <select class="form-input" id="rg-influencer"><option value="">All influencers</option></select>
          </label>
          <label class="rf-field">
            <span>From</span>
            <input type="date" class="form-input" id="rg-start" />
          </label>
          <label class="rf-field">
            <span>To</span>
            <input type="date" class="form-input" id="rg-end" />
          </label>
          <div class="rf-actions">
            <button type="button" class="btn btn-secondary" id="rg-reset">Reset</button>
            <button type="button" class="btn btn-secondary" id="rg-refresh" data-lock>Refresh</button>
          </div>
        </div>
        <p class="rf-note" id="rg-lookup-note"></p>

        <div class="rf-bulkbar rf-hidden" id="rg-bulkbar">
          <strong id="rg-bulk-count">0 selected</strong>
          <button type="button" class="btn btn-primary rf-btn-sm" data-bulk="mark_paid" data-lock>Mark selected as paid</button>
          <button type="button" class="btn rf-danger rf-btn-sm" data-bulk="mark_cancelled" data-lock>Mark selected as cancelled</button>
          <button type="button" class="btn btn-secondary rf-btn-sm" data-bulk-clear>Clear selection</button>
        </div>

        <div id="rg-content"></div>
        <div class="rf-pagination rf-hidden" id="rg-pagination"></div>
      </div>
    `;

    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('input', onInput);

    lookupsReady = loadLookups();
    load();
  }

  window.registrationsPage = {
    render,
    normalise: normaliseRegistration, // exposed for testing
  };
})();