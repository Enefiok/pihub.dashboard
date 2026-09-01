/* ==========================================================================
   PIHUB Dashboard — Customers Page
   NOTE: No dedicated /customers/ endpoint exists (customers don't have
   accounts per your architecture). This derives a unique customer list
   from bookings. Confirm this is the right source once we review models.
   ========================================================================== */

window.customersPage = {
  state: { data: [] },

  async render(container) {
    const currentUser = auth.getUser();
    
    // Check if user has permission to view customers
    // Management and Receptionist can view all customers
    // Instructors might need special handling (see note below)
    const canViewCustomers = currentUser && 
      ['CEO', 'LEAD_DEVELOPER', 'ADMIN', 'RECEPTIONIST'].includes(currentUser.role);

    if (!canViewCustomers) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Access restricted</h3>
          <p>Only management and receptionist staff can view the customer list.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
        <div class="table-toolbar">
          <input class="form-input" id="customer-search" placeholder="Search name or email..." style="width:260px;" />
        </div>
        <div id="customers-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;

    document.getElementById('customer-search').addEventListener('input', utils.debounce((e) => {
      this.renderTable(e.target.value.trim().toLowerCase());
    }, 350));

    await this.load();
  },

  async load() {
    const target = document.getElementById('customers-table-container');
    try {
      const data = await api.get(CONFIG.ENDPOINTS.BOOKINGS);
      const bookings = data.results || data || [];

      const map = new Map();
      bookings.forEach(b => {
        if (!b.customer_email) return;
        if (!map.has(b.customer_email)) {
          map.set(b.customer_email, {
            name: b.customer_name,
            email: b.customer_email,
            phone: b.customer_phone,
            bookingCount: 1,
          });
        } else {
          map.get(b.customer_email).bookingCount += 1;
        }
      });

      this.state.data = Array.from(map.values());
      this.renderTable();
    } catch (err) {
      target.innerHTML = `<div class="empty-state"><h3>Couldn't load customers</h3><p>${err.message}</p></div>`;
    }
  },

  renderTable(search = '') {
    const target = document.getElementById('customers-table-container');
    let rows = this.state.data;
    if (search) {
      rows = rows.filter(c =>
        (c.name || '').toLowerCase().includes(search) ||
        (c.email || '').toLowerCase().includes(search)
      );
    }

    if (rows.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No customers found</h3></div>`;
      return;
    }

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Total Bookings</th></tr></thead>
        <tbody>
          ${rows.map(c => `
            <tr>
              <td>${c.name || '—'}</td>
              <td>${c.email}</td>
              <td>${c.phone || '—'}</td>
              <td>${c.bookingCount}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },
};