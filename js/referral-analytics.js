/* ==========================================================================
   PIHUB Dashboard - Referral Analytics page
   Staff only: CEO, LEAD_DEVELOPER (also 'LEAD DEVELOPER'), ADMIN.

   GET CONFIG.ENDPOINTS.REFERRAL_ANALYTICS ?start_date=&end_date=&group_by=day|week|month

   Response shapes assumed (every key is optional; a missing key shows "No data yet"):
     summary: {
       total_registrations, paid_registrations, pending_registrations, cancelled_registrations,
       total_revenue (string), total_discount_given (string), total_commission_owed (string),
       conversion_rate_percent (number)
     }
     status_counts: { paid, pending, cancelled }
     time_series:   [ { date, registrations, paid_conversions, revenue (string) } ]
     by_influencer: [ { influencer_id, influencer_name, registrations, paid | paid_count, revenue,
                        discount_given, commission_owed, conversion_rate_percent } ]
                    older names: referral_code__influencer__name (and __id)
     by_code:       [ { code, registrations, paid | paid_count, revenue, commission_owed } ]
                    older name: referral_code__code
     top_courses:   [ { course_title, registrations, paid | paid_count } ]
                    older name: course__title
   Money values are strings such as "10000.00". Revenue and commission count paid
   registrations only.

   Chart.js: the dashboard does not load it globally, so it is loaded once from
   cdnjs when this page opens. Cards and tables still render if the CDN is blocked.
   ========================================================================== */

(function () {
  const S = window.referralShared;
  const EP = CONFIG.ENDPOINTS;
  const DASH = S.DASH;
  const CHART_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';

  let root = null;
  let charts = [];
  let chartLoader = null;
  let loading = false;
  let reqId = 0;
  const filters = { start_date: '', end_date: '', group_by: 'day' };

  /* ---------- normaliser ---------- */
  function listOrNull(value) {
    return Array.isArray(value) ? value : null;
  }

  function normaliseAnalytics(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};

    const sm = r.summary && typeof r.summary === 'object' ? r.summary : null;
    const summary = sm ? {
      totalRegistrations: S.toNumber(sm.total_registrations),
      paidRegistrations: S.toNumber(sm.paid_registrations),
      pendingRegistrations: S.toNumber(sm.pending_registrations),
      cancelledRegistrations: S.toNumber(sm.cancelled_registrations),
      totalRevenue: S.toNumber(sm.total_revenue),
      totalDiscountGiven: S.toNumber(sm.total_discount_given),
      totalCommissionOwed: S.toNumber(sm.total_commission_owed),
      conversionRate: S.toNumber(sm.conversion_rate_percent),
    } : null;

    const sc = r.status_counts && typeof r.status_counts === 'object' ? r.status_counts : null;
    const statusCounts = sc ? {
      paid: S.toNumber(sc.paid) || 0,
      pending: S.toNumber(sc.pending) || 0,
      cancelled: S.toNumber(sc.cancelled) || 0,
    } : null;

    const ts = listOrNull(r.time_series);
    const timeSeries = ts ? ts.map((p) => {
      const x = p || {};
      return {
        date: S.str(x.date),
        registrations: S.toNumber(x.registrations) || 0,
        paidConversions: S.toNumber(x.paid_conversions) || 0,
        revenue: S.toNumber(x.revenue) || 0,
      };
    }) : null;

    const bi = listOrNull(r.by_influencer);
    const byInfluencer = bi ? bi.map((row) => {
      const x = row || {};
      const registrations = S.toNumber(x.registrations);
      const paid = S.toNumber(S.pick(x, 'paid', 'paid_count'));
      let conversion = S.toNumber(x.conversion_rate_percent);
      if (conversion === null && registrations && paid !== null) conversion = (paid / registrations) * 100;
      return {
        id: S.pick(x, 'influencer_id', 'referral_code__influencer__id', 'referral_code__influencer') ?? null,
        name: S.str(S.pick(x, 'influencer_name', 'referral_code__influencer__name')) || 'Unknown',
        registrations,
        paid,
        revenue: S.toNumber(x.revenue),
        discountGiven: S.toNumber(x.discount_given),
        commissionOwed: S.toNumber(x.commission_owed),
        conversion,
      };
    }) : null;

    const bc = listOrNull(r.by_code);
    const byCode = bc ? bc.map((row) => {
      const x = row || {};
      return {
        code: S.str(S.pick(x, 'code', 'referral_code__code')) || DASH,
        registrations: S.toNumber(x.registrations),
        paid: S.toNumber(S.pick(x, 'paid', 'paid_count')),
        revenue: S.toNumber(x.revenue),
        commissionOwed: S.toNumber(x.commission_owed),
      };
    }) : null;

    const tc = listOrNull(r.top_courses);
    const topCourses = tc ? tc.map((row) => {
      const x = row || {};
      return {
        title: S.str(S.pick(x, 'course_title', 'course__title')) || 'Unknown course',
        registrations: S.toNumber(x.registrations) || 0,
        paid: S.toNumber(S.pick(x, 'paid', 'paid_count')) || 0,
      };
    }) : null;

    return { summary, statusCounts, timeSeries, byInfluencer, byCode, topCourses };
  }

  /* ---------- chart helpers ---------- */
  function palette() {
    return {
      primary: S.cssVar('--color-primary', '#ea580c'),
      success: S.cssVar('--color-success', '#16a34a'),
      warning: S.cssVar('--color-warning', '#f59e0b'),
      danger: S.cssVar('--color-danger', '#dc2626'),
      info: S.cssVar('--color-info', '#2563eb'),
    };
  }

  function ensureChartLib() {
    if (window.Chart) return Promise.resolve();
    if (chartLoader) return chartLoader;
    chartLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CHART_URL;
      script.onload = () => (window.Chart ? resolve() : reject(new Error('Chart.js is unavailable.')));
      script.onerror = () => {
        chartLoader = null;
        reject(new Error('Chart.js failed to load.'));
      };
      document.head.appendChild(script);
    });
    return chartLoader;
  }

  function destroyCharts() {
    charts.forEach((c) => { try { c.destroy(); } catch (e) { /* ignore */ } });
    charts = [];
  }

  function compactNaira(value) {
    const n = S.toNumber(value);
    if (n === null) return '';
    return '\u20A6' + new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  }

  function bucketLabel(date) {
    if (!date) return DASH;
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    if (filters.group_by === 'month') {
      return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  function axisColors() {
    const text = getComputedStyle(document.body).color || '#374151';
    return { text, grid: 'rgba(128, 128, 128, 0.2)' };
  }

  function legendOptions(position) {
    return { position: position || 'bottom', labels: { color: axisColors().text } };
  }

  function linearScale(extra) {
    const c = axisColors();
    return Object.assign({
      beginAtZero: true,
      ticks: { color: c.text, precision: 0 },
      grid: { color: c.grid },
    }, extra || {});
  }

  function categoryScale(extra) {
    const c = axisColors();
    return Object.assign({
      ticks: { color: c.text },
      grid: { display: false },
    }, extra || {});
  }

  function moneyTooltip(ctx) {
    const isMoney = ctx.dataset.yAxisID === 'y1';
    const value = ctx.parsed.y;
    return `${ctx.dataset.label}: ${isMoney ? S.money(value) : S.num(value)}`;
  }

  function buildCharts(data) {
    const P = palette();

    const statusCanvas = root.querySelector('#ra-chart-status');
    if (statusCanvas && data.statusCounts) {
      charts.push(new window.Chart(statusCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Paid', 'Pending', 'Cancelled'],
          datasets: [{
            data: [data.statusCounts.paid, data.statusCounts.pending, data.statusCounts.cancelled],
            backgroundColor: [P.success, P.warning, P.danger],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: legendOptions('bottom') },
        },
      }));
    }

    const seriesCanvas = root.querySelector('#ra-chart-series');
    if (seriesCanvas && data.timeSeries) {
      charts.push(new window.Chart(seriesCanvas, {
        type: 'line',
        data: {
          labels: data.timeSeries.map((p) => bucketLabel(p.date)),
          datasets: [
            {
              label: 'Registrations',
              data: data.timeSeries.map((p) => p.registrations),
              borderColor: P.primary,
              backgroundColor: P.primary,
              tension: 0.25,
              yAxisID: 'y',
            },
            {
              label: 'Paid conversions',
              data: data.timeSeries.map((p) => p.paidConversions),
              borderColor: P.success,
              backgroundColor: P.success,
              tension: 0.25,
              yAxisID: 'y',
            },
            {
              label: 'Revenue',
              data: data.timeSeries.map((p) => p.revenue),
              borderColor: P.info,
              backgroundColor: P.info,
              borderDash: [6, 4],
              tension: 0.25,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: legendOptions('bottom'),
            tooltip: { callbacks: { label: moneyTooltip } },
          },
          scales: {
            x: categoryScale(),
            y: linearScale({ position: 'left' }),
            y1: linearScale({
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: axisColors().text, callback: (v) => compactNaira(v) },
            }),
          },
        },
      }));
    }

    const coursesCanvas = root.querySelector('#ra-chart-courses');
    if (coursesCanvas && data.topCourses) {
      const top = data.topCourses.slice(0, 10);
      charts.push(new window.Chart(coursesCanvas, {
        type: 'bar',
        data: {
          labels: top.map((c) => c.title),
          datasets: [
            { label: 'Registrations', data: top.map((c) => c.registrations), backgroundColor: P.primary },
            { label: 'Paid', data: top.map((c) => c.paid), backgroundColor: P.success },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: legendOptions('bottom') },
          scales: {
            x: linearScale(),
            y: categoryScale(),
          },
        },
      }));
    }

    const inflCanvas = root.querySelector('#ra-chart-influencers');
    if (inflCanvas && data.byInfluencer) {
      const top = data.byInfluencer
        .slice()
        .sort((a, b) => (b.registrations || 0) - (a.registrations || 0))
        .slice(0, 10);
      charts.push(new window.Chart(inflCanvas, {
        type: 'bar',
        data: {
          labels: top.map((i) => i.name),
          datasets: [
            {
              label: 'Registrations',
              data: top.map((i) => i.registrations || 0),
              backgroundColor: P.primary,
              yAxisID: 'y',
            },
            {
              label: 'Revenue',
              data: top.map((i) => i.revenue || 0),
              backgroundColor: P.info,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: legendOptions('bottom'),
            tooltip: { callbacks: { label: moneyTooltip } },
          },
          scales: {
            x: categoryScale(),
            y: linearScale({ position: 'left' }),
            y1: linearScale({
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: axisColors().text, callback: (v) => compactNaira(v) },
            }),
          },
        },
      }));
    }
  }

  /* ---------- rendering ---------- */
  function noData() {
    return '<div class="rf-state rf-muted">No data yet</div>';
  }

  function statCard(label, value) {
    return `
      <div class="rf-panel">
        <div class="rf-stat-label">${S.esc(label)}</div>
        <div class="rf-stat-value">${S.esc(value)}</div>
      </div>`;
  }

  function chartPanel(title, canvasId, hasData, extraClass) {
    return `
      <div class="rf-panel ${extraClass || ''}">
        <h3 class="rf-chart-title">${S.esc(title)}</h3>
        ${hasData ? `<div class="rf-chart-box"><canvas id="${canvasId}"></canvas></div>` : noData()}
      </div>`;
  }

  function summaryHtml(summary) {
    if (!summary) {
      return `<div class="rf-panel"><h3 class="rf-chart-title">Summary</h3>${noData()}</div>`;
    }
    return `
      <div class="rf-cards">
        ${statCard('Total registrations', S.num(summary.totalRegistrations))}
        ${statCard('Paid', S.num(summary.paidRegistrations))}
        ${statCard('Pending', S.num(summary.pendingRegistrations))}
        ${statCard('Cancelled', S.num(summary.cancelledRegistrations))}
        ${statCard('Total revenue', S.money(summary.totalRevenue))}
        ${statCard('Discount given', S.money(summary.totalDiscountGiven))}
        ${statCard('Commission owed', S.money(summary.totalCommissionOwed))}
        ${statCard('Conversion rate', S.percent(summary.conversionRate))}
      </div>`;
  }

  function leaderboardHtml(list) {
    let body = noData();
    if (list && list.length) {
      const sorted = list.slice().sort((a, b) =>
        ((b.revenue || 0) - (a.revenue || 0)) || ((b.registrations || 0) - (a.registrations || 0)));
      body = `
        <div class="rf-table-wrap">
          <table class="rf-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Influencer</th>
                <th class="rf-num">Registrations</th>
                <th class="rf-num">Paid</th>
                <th class="rf-num">Conversion</th>
                <th class="rf-num">Revenue</th>
                <th class="rf-num">Discount given</th>
                <th class="rf-num">Commission owed</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((i, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${S.esc(i.name)}</td>
                  <td class="rf-num">${S.esc(S.num(i.registrations))}</td>
                  <td class="rf-num">${S.esc(S.num(i.paid))}</td>
                  <td class="rf-num">${S.esc(S.percent(i.conversion))}</td>
                  <td class="rf-num">${S.esc(S.money(i.revenue))}</td>
                  <td class="rf-num">${S.esc(S.money(i.discountGiven))}</td>
                  <td class="rf-num">${S.esc(S.money(i.commissionOwed))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
    return `<div class="rf-panel"><h3 class="rf-section-title">Influencer leaderboard</h3>${body}</div>`;
  }

  function codesHtml(list) {
    let body = noData();
    if (list && list.length) {
      const sorted = list.slice().sort((a, b) => (b.registrations || 0) - (a.registrations || 0));
      body = `
        <div class="rf-table-wrap">
          <table class="rf-table">
            <thead>
              <tr>
                <th>Code</th>
                <th class="rf-num">Registrations</th>
                <th class="rf-num">Paid</th>
                <th class="rf-num">Revenue</th>
                <th class="rf-num">Commission owed</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((c) => `
                <tr>
                  <td>${S.esc(c.code)}</td>
                  <td class="rf-num">${S.esc(S.num(c.registrations))}</td>
                  <td class="rf-num">${S.esc(S.num(c.paid))}</td>
                  <td class="rf-num">${S.esc(S.money(c.revenue))}</td>
                  <td class="rf-num">${S.esc(S.money(c.commissionOwed))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
    return `<div class="rf-panel"><h3 class="rf-section-title">Performance by code</h3>${body}</div>`;
  }

  function renderContent(data) {
    const statusHas = !!data.statusCounts &&
      (data.statusCounts.paid + data.statusCounts.pending + data.statusCounts.cancelled) > 0;
    const seriesHas = !!data.timeSeries && data.timeSeries.length > 0;
    const coursesHas = !!data.topCourses && data.topCourses.length > 0;
    const inflHas = !!data.byInfluencer && data.byInfluencer.length > 0;

    root.querySelector('#ra-content').innerHTML = `
      ${summaryHtml(data.summary)}
      <div class="rf-charts">
        ${chartPanel('Registrations by status', 'ra-chart-status', statusHas)}
        ${chartPanel('Top courses', 'ra-chart-courses', coursesHas)}
        ${chartPanel('Registrations over time', 'ra-chart-series', seriesHas, 'rf-span-all')}
        ${chartPanel('Influencers: registrations and revenue', 'ra-chart-influencers', inflHas, 'rf-span-all')}
      </div>
      ${leaderboardHtml(data.byInfluencer)}
      ${codesHtml(data.byCode)}
    `;
  }

  /* ---------- loading ---------- */
  function applyLocks() {
    if (!root) return;
    root.querySelectorAll('[data-lock]').forEach((b) => { b.disabled = loading; });
  }

  function buildParams() {
    const p = {};
    Object.keys(filters).forEach((k) => { if (filters[k]) p[k] = filters[k]; });
    return p;
  }

  async function load() {
    const token = ++reqId;
    loading = true;
    destroyCharts();
    root.querySelector('#ra-content').innerHTML = S.loadingHtml('Loading analytics...');
    applyLocks();

    try {
      const raw = await api.get(EP.REFERRAL_ANALYTICS, buildParams());
      if (token !== reqId) return;

      const data = normaliseAnalytics(raw);
      loading = false;
      renderContent(data);
      applyLocks();

      const needsCharts = root.querySelector('.rf-chart-box');
      if (needsCharts) {
        try {
          await ensureChartLib();
          if (token !== reqId) return;
          buildCharts(data);
        } catch (chartErr) {
          if (token !== reqId) return;
          root.querySelectorAll('.rf-chart-box').forEach((box) => {
            box.innerHTML = '<div class="rf-state rf-muted">Charts could not be loaded. The tables above and below still show the data.</div>';
          });
        }
      }
    } catch (err) {
      if (token !== reqId) return;
      loading = false;
      root.querySelector('#ra-content').innerHTML = S.errorHtml(S.errMsg(err));
      applyLocks();
    }
  }

  function readFilters() {
    filters.start_date = root.querySelector('#ra-start').value;
    filters.end_date = root.querySelector('#ra-end').value;
    filters.group_by = root.querySelector('#ra-group').value || 'day';
  }

  function apply() {
    readFilters();
    if (filters.start_date && filters.end_date && filters.start_date > filters.end_date) {
      S.notifyError('The start date must be on or before the end date.');
      return;
    }
    load();
  }

  function reset() {
    root.querySelector('#ra-start').value = '';
    root.querySelector('#ra-end').value = '';
    root.querySelector('#ra-group').value = 'day';
    readFilters();
    load();
  }

  /* ---------- render ---------- */
  function render(container) {
    if (!S.ensureAccess(container)) return;
    S.injectStyles();

    root = container;
    filters.start_date = '';
    filters.end_date = '';
    filters.group_by = 'day';

    container.innerHTML = `
      <div class="rf-page">
        <div class="rf-toolbar">
          <label class="rf-field">
            <span>From</span>
            <input type="date" class="form-input" id="ra-start" />
          </label>
          <label class="rf-field">
            <span>To</span>
            <input type="date" class="form-input" id="ra-end" />
          </label>
          <label class="rf-field">
            <span>Group by</span>
            <select class="form-input" id="ra-group">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
          <div class="rf-actions">
            <button type="button" class="btn btn-primary" id="ra-apply" data-lock>Apply</button>
            <button type="button" class="btn btn-secondary" id="ra-reset" data-lock>Reset</button>
          </div>
        </div>
        <p class="rf-note">Revenue and commission figures count paid registrations only.</p>
        <div class="rf-page" id="ra-content"></div>
      </div>
    `;

    container.addEventListener('click', (e) => {
      if (e.target.closest('[data-rf-retry]')) {
        load();
        return;
      }
      const btn = e.target.closest('button');
      if (!btn || btn.disabled) return;
      if (btn.id === 'ra-apply') apply();
      else if (btn.id === 'ra-reset') reset();
    });

    load();
  }

  window.referralAnalyticsPage = {
    render,
    normalise: normaliseAnalytics, // exposed for testing
  };
})();