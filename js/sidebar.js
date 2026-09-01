/* ==========================================================================
   PIHUB Dashboard — Sidebar
   ========================================================================== */

const SIDEBAR_LINKS = [
  { id: 'dashboard',       label: 'Dashboard',       icon: 'grid',      roles: null },
  { id: 'bookings',        label: 'Bookings',        icon: 'calendar',  roles: ['CEO', 'LEAD_DEVELOPER', 'ADMIN', 'RECEPTIONIST'] },
  { id: 'workspace-tags',  label: 'Workspace Tags',  icon: 'tag',       roles: ['CEO', 'LEAD_DEVELOPER', 'ADMIN', 'RECEPTIONIST'] },
  { id: 'workspace-plans', label: 'Workspace Plans', icon: 'layers',    roles: ['CEO', 'LEAD_DEVELOPER', 'ADMIN', 'RECEPTIONIST'] },
  { id: 'courses',         label: 'Courses',         icon: 'book',      roles: null },
  { id: 'students',        label: 'Students',        icon: 'users',     roles: null },
  { id: 'certificates',    label: 'Certificates',    icon: 'award',     roles: null },
  { id: 'customers',       label: 'Customers',       icon: 'user',      roles: ['CEO', 'LEAD_DEVELOPER', 'ADMIN', 'RECEPTIONIST'] },
  { id: 'payments',        label: 'Payments',        icon: 'credit-card', roles: ['CEO', 'LEAD_DEVELOPER', 'ADMIN'] },
  { id: 'blog',            label: 'Blog Posts',      icon: 'file-text', roles: null },
  { id: 'gallery',         label: 'Gallery',         icon: 'image',     roles: null },
  { id: 'enquiries',       label: 'Enquiries',       icon: 'inbox',     roles: null },
  { id: 'newsletters',     label: 'Newsletters',     icon: 'mail',      roles: null },
  { id: 'staff',           label: 'Staff',           icon: 'shield',    roles: ['CEO', 'LEAD_DEVELOPER'] },
];

const sidebar = {
  render(activePageId) {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;

    const role = auth.getRole();
    nav.innerHTML = '';

    SIDEBAR_LINKS.forEach(link => {
      if (link.roles && !link.roles.includes(role)) return;

      const isActive = link.id === activePageId;
      const node = utils.el(`
        <a href="dashboard.html?page=${link.id}" class="sidebar-link ${isActive ? 'active' : ''}" data-page="${link.id}">
          ${this.iconSvg(link.icon)}
          <span>${link.label}</span>
        </a>
      `);
      nav.appendChild(node);
    });
  },

  iconSvg(name) {
    // Minimal placeholder icon set (stroke-based, 18x18).
    // Swap for a proper icon library/sprite later if you want.
    const icons = {
      grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      tag: '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
      layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
      book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5v-16Z"/><path d="M4 20.5V18"/>',
      users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
      'credit-card': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
      'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
      image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
      inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
      mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
  },

  initToggle() {
    const shell = document.querySelector('.app-shell');
    const sidebarEl = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const menuBtn = document.getElementById('menu-toggle-btn');
    const closeBtn = document.getElementById('sidebar-close-btn');
    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

    const openMobileSidebar = () => {
      sidebarEl.classList.add('mobile-open');
      if (backdrop) backdrop.classList.add('active');
    };

    const closeMobileSidebar = () => {
      sidebarEl.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('active');
    };

    if (menuBtn && shell && sidebarEl) {
      menuBtn.addEventListener('click', () => {
        if (isMobile()) {
          sidebarEl.classList.contains('mobile-open') ? closeMobileSidebar() : openMobileSidebar();
        } else {
          shell.classList.toggle('sidebar-collapsed');
        }
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeMobileSidebar);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMobileSidebar);
    }

    // If the window is resized past the mobile breakpoint while the
    // slide-in sidebar is open, close it so it doesn't get stuck open
    // underneath the desktop layout.
    window.addEventListener('resize', () => {
      if (!isMobile()) closeMobileSidebar();
    });
  },
};