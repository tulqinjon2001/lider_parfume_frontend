function initAdminMobileNav() {
  const header = document.querySelector('.admin-header');
  if (!header || header.dataset.navReady) return;

  const tabs = header.querySelector('.admin-tabs');
  const actions = header.querySelector('.admin-header-actions');
  if (!tabs || !actions) return;

  header.dataset.navReady = '1';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'admin-menu-toggle';
  toggle.id = 'adminMenuToggle';
  toggle.setAttribute('aria-label', 'Menyu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'adminHeaderNav');
  toggle.innerHTML = `
    <span class="admin-menu-bar"></span>
    <span class="admin-menu-bar"></span>
    <span class="admin-menu-bar"></span>
  `;

  const nav = document.createElement('div');
  nav.className = 'admin-header-nav';
  nav.id = 'adminHeaderNav';
  tabs.before(nav);
  nav.append(tabs, actions);
  header.insertBefore(toggle, nav);

  let backdrop = document.getElementById('adminMenuBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'admin-menu-backdrop hidden';
    backdrop.id = 'adminMenuBackdrop';
    header.after(backdrop);
  }

  function setOpen(open) {
    header.classList.toggle('is-menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    backdrop.classList.toggle('hidden', !open);
    document.body.classList.toggle('admin-menu-open', open);
  }

  toggle.addEventListener('click', () => setOpen(!header.classList.contains('is-menu-open')));
  backdrop.addEventListener('click', () => setOpen(false));
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('is-menu-open')) setOpen(false);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminMobileNav);
} else {
  initAdminMobileNav();
}
