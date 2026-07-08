// Shared UI helpers.

const Utils = {
  esc(str) {
    if (str == null) return '';
    return String(str)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  },
  timeAgo(iso) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  },
  avatarHtml(user, size = 'md') {
    const letter = (user?.username || '?')[0].toUpperCase();
    if (user?.profile_pic_url) {
      const esc = Utils.esc(user.profile_pic_url);
      return `<div class="avatar ${size}"><img src="${esc}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${Utils.esc(letter)}'}))"></div>`;
    }
    return `<div class="avatar ${size}">${Utils.esc(letter)}</div>`;
  },
  heartIcon(filled) {
    return filled
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  },
  commentIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  },
};

// Render sidebar into #sidebar-slot. active = 'home' | 'profile'
function renderSidebar(active = 'home') {
  const me = API.getCurrentUser();
  const slot = document.getElementById('sidebar-slot');
  if (!slot || !me) return;
  slot.innerHTML = `
    <div class="logo">social<span class="dot">.</span></div>
    <a href="/feed.html" class="nav-item ${active === 'home' ? 'active' : ''}">
      <span>🏠</span><span class="nav-label">Home</span>
    </a>
    <a href="/profile.html" class="nav-item ${active === 'profile' ? 'active' : ''}">
      <span>👤</span><span class="nav-label">Profile</span>
    </a>
    <a href="#" class="nav-item" id="nav-logout">
      <span>🚪</span><span class="nav-label">Logout</span>
    </a>
    <div class="sidebar-user">
      ${Utils.avatarHtml(me, 'md')}
      <div>
        <div style="font-weight:600;">${Utils.esc(me.username)}</div>
        <div class="text-muted" style="font-size:12px;">Signed in</div>
      </div>
    </div>
  `;
  document.getElementById('nav-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    API.clearAuth();
    window.location.href = '/login.html';
  });
}

window.Utils = Utils;
window.renderSidebar = renderSidebar;
