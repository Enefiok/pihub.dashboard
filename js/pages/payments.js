/* ==========================================================================
   PIHUB Dashboard — Payments Page
   NOTE: No "list all payments" endpoint is confirmed in your Postman doc
   (only the webhook receiver is documented). This assumes a staff endpoint
   at /api/payments/ — CONFIRM this path with your backend dev / viewsets
   before relying on this page.
   ========================================================================== */

window.paymentsPage = {
  state: { data: [] },

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

    target.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Booking</th><th>Date</th></tr></thead>
        <tbody>
          ${this.state.data.map(p => `
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
    `;
  },
};