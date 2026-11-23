/* ==========================================================================
   PIHUB Dashboard — Payments Page
   NOTE: No "list all payments" endpoint is confirmed in your Postman doc
   (only the webhook receiver is documented). This assumes a staff endpoint
   at /api/payments/ — CONFIRM this path with your backend dev / viewsets
   before relying on this page.
   ========================================================================== */

window.paymentsPage = {
  state: { data: [], page: 1, pageSize: 5 },

  async render(container) {
    container.innerHTML = `
      <div class="table-wrapper">
        <div id="payments-table-container">
          <div style="padding:var(--space-6);" class="skeleton" style="height:200px;"></div>
        </div>
      </div>
    `;
    await this.load();
  },

  async load() {
    const target = document.getElementById('payments-table-container');
    try {
      const data = await api.get('/api/payments/'); // unconfirmed — placeholder path
      this.state.data = data.results || data || [];
      this.renderTable();
    } catch (err) {
      target.innerHTML = `
        <div class="empty-state">
          <h3>Payments endpoint not confirmed yet</h3>
          <p>We'll wire this up once you share the payments viewset/URL.</p>
        </div>
      `;
    }
  },

  renderTable() {
    const target = document.getElementById('payments-table-container');
    if (this.state.data.length === 0) {
      target.innerHTML = `<div class="empty-state"><h3>No payments found</h3></div>`;
      return;
    }

    // Pagination: show only `pageSize` payments at a time
    const total = this.state.data.length;
    const { pageSize } = this.state;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    this.state.page = Math.min(Math.max(1, this.state.page), totalPages);
    const startIdx = (this.state.page - 1) * pageSize;
    const pageItems = this.state.data.slice(startIdx, startIdx + pageSize);
    const rangeStart = startIdx + 1;
    const rangeEnd = startIdx + pageItems.length;

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Booking</th><th>Date</th></tr></thead>
        <tbody>
          ${pageItems.map(p => `
            <tr>
              <td style="font-family:monospace;font-size:var(--font-size-xs);">${p.reference || '—'}</td>
              <td>${utils.formatCurrency(p.amount)}</td>
              <td><span class="badge ${utils.badgeClassForStatus(p.status)}">${p.status || '—'}</span></td>
              <td>#${p.booking || p.booking_id || '—'}</td>
              <td>${utils.formatDateTime(p.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="table-pagination">
        <span class="table-pagination-info">${rangeStart}–${rangeEnd} of ${total}</span>
        <div class="table-pagination-controls">
          <button class="btn btn-sm btn-secondary" id="payments-prev" ${this.state.page <= 1 ? 'disabled' : ''}>Previous</button>
          <button class="btn btn-sm btn-secondary" id="payments-next" ${this.state.page >= totalPages ? 'disabled' : ''}>Next</button>
        </div>
      </div>
    `;

    target.querySelector('#payments-prev').addEventListener('click', () => {
      this.state.page -= 1;
      this.renderTable();
    });
    target.querySelector('#payments-next').addEventListener('click', () => {
      this.state.page += 1;
      this.renderTable();
    });
  },
};