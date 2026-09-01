/* ==========================================================================
   PIHUB Dashboard — Dashboard Home (Overview) Page
   ========================================================================== */

window.dashboardHomePage = {
  async render(container) {
    container.innerHTML = `
      <div class="metrics-grid" id="metrics-grid">
        ${this.metricSkeleton()}
        ${this.metricSkeleton()}
        ${this.metricSkeleton()}
        ${this.metricSkeleton()}
      </div>

      <div class="card">
        <h2 style="margin-bottom: var(--space-4);">Recent Activity</h2>
        <div id="recent-activity" class="recent-activity-list">
          ${this.activitySkeleton()}
        </div>
      </div>
    `;

    this.loadMetrics();
    this.loadRecentActivity();
  },

  metricSkeleton() {
    return `
      <div class="metric-card">
        <div class="skeleton" style="width:60%;height:14px;"></div>
        <div class="skeleton" style="width:40%;height:28px;margin-top:8px;"></div>
      </div>
    `;
  },

  activitySkeleton() {
    return Array.from({ length: 3 }).map(() => `
      <div class="recent-activity-item">
        <div class="skeleton" style="width:70%;height:14px;"></div>
        <div class="skeleton" style="width:15%;height:14px;"></div>
      </div>
    `).join('');
  },

  async loadMetrics() {
    const grid = document.getElementById('metrics-grid');

    // Bookings, courses, and subscribers are all confirmed endpoints now.
    // Pending payments is still not confirmed — flagged below.
    const [bookingsResult, coursesResult, subscribersResult] = await Promise.allSettled([
      api.get(CONFIG.ENDPOINTS.BOOKINGS),
      api.get(CONFIG.ENDPOINTS.COURSES),
      api.get(CONFIG.ENDPOINTS.SUBSCRIBERS),
    ]);

    const bookings = bookingsResult.status === 'fulfilled'
      ? (bookingsResult.value.results || bookingsResult.value)
      : [];
    const courses = coursesResult.status === 'fulfilled'
      ? (coursesResult.value.results || coursesResult.value)
      : [];
    const subscribers = subscribersResult.status === 'fulfilled'
      ? (subscribersResult.value.results || subscribersResult.value)
      : [];

    const activeBookings = Array.isArray(bookings)
      ? bookings.filter(b => b.status === 'ACTIVE').length
      : '—';

    const totalCourses = Array.isArray(courses) ? courses.length : '—';

    const activeSubscribers = Array.isArray(subscribers)
      ? subscribers.filter(s => s.is_active).length
      : '—';

    const metrics = [
      { label: 'Total Active Bookings', value: activeBookings },
      { label: 'Total Newsletter Subscribers', value: activeSubscribers },
      { label: 'Pending Payments', value: '—', note: 'Endpoint not yet confirmed' },
      { label: 'Total Courses', value: totalCourses },
    ];

    grid.innerHTML = metrics.map(m => `
      <div class="metric-card">
        <span class="metric-card-label">${m.label}</span>
        <span class="metric-card-value">${m.value}</span>
        ${m.note ? `<span style="font-size:var(--font-size-xs);color:var(--color-grey-300);">${m.note}</span>` : ''}
      </div>
    `).join('');
  },

  async loadRecentActivity() {
    const listEl = document.getElementById('recent-activity');

    try {
      const data = await api.get(CONFIG.ENDPOINTS.BOOKINGS);
      const bookings = data.results || data;

      if (!Array.isArray(bookings) || bookings.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <h3>No recent activity</h3>
            <p>New bookings will show up here.</p>
          </div>
        `;
        return;
      }

      const recent = bookings
        .slice()
        .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
        .slice(0, 5);

      listEl.innerHTML = recent.map(b => `
        <div class="recent-activity-item">
          <span>
            <strong>${b.customer_name || 'Guest'}</strong>
            booked <strong>${b.workspace_plan_name || 'a workspace'}</strong>
          </span>
          <span class="badge ${utils.badgeClassForStatus(b.status)}">${b.status || '—'}</span>
        </div>
      `).join('');
    } catch (err) {
      listEl.innerHTML = `
        <div class="empty-state">
          <h3>Couldn't load activity</h3>
          <p>${err.message}</p>
        </div>
      `;
    }
  },
};