// Feed page logic.

if (!API.requireAuthOrRedirect()) throw new Error('redirecting');

renderSidebar('home');

const me = API.getCurrentUser();
document.getElementById('me-avatar-slot').innerHTML = Utils.avatarHtml(me, 'md');

let currentFeed = 'all'; // 'all' | 'following'
let page = 1;
let hasMore = true;
let loading = false;
let pendingImage = null;

// ============ Create post ============
const contentEl = document.getElementById('new-content');
const postBtn = document.getElementById('post-btn');
const imageInput = document.getElementById('image-input');
const imagePreviewSlot = document.getElementById('image-preview-slot');
const postAlert = document.getElementById('post-alert');

function updatePostBtn() {
  postBtn.disabled = !contentEl.value.trim() && !pendingImage;
}
contentEl.addEventListener('input', updatePostBtn);

imageInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) { pendingImage = null; imagePreviewSlot.innerHTML = ''; updatePostBtn(); return; }
  if (file.size > 5 * 1024 * 1024) {
    API.showToast('Image too large (max 5 MB)', 'error');
    imageInput.value = ''; return;
  }
  pendingImage = file;
  const url = URL.createObjectURL(file);
  imagePreviewSlot.innerHTML = `
    <div class="image-preview">
      <img src="${url}" alt="">
      <button class="remove" title="Remove" id="remove-image">×</button>
    </div>`;
  document.getElementById('remove-image').addEventListener('click', () => {
    pendingImage = null; imageInput.value = ''; imagePreviewSlot.innerHTML = ''; updatePostBtn();
  });
  updatePostBtn();
});

postBtn.addEventListener('click', async () => {
  postAlert.classList.remove('show');
  const content = contentEl.value.trim();
  if (!content && !pendingImage) return;
  postBtn.disabled = true; postBtn.innerHTML = '<span class="spinner"></span>';
  try {
    const form = new FormData();
    form.append('content', content);
    if (pendingImage) form.append('image', pendingImage);
    const { post } = await API.request('/api/posts', { method: 'POST', auth: true, form });
    // Prepend to feed (only if we're on the "all" tab or if it fits current feed)
    contentEl.value = '';
    pendingImage = null; imageInput.value = ''; imagePreviewSlot.innerHTML = '';
    if (currentFeed === 'all' || currentFeed === 'following') {
      document.getElementById('feed-list').insertAdjacentHTML('afterbegin', renderPostCard(post));
      bindCardHandlers(document.querySelector(`[data-post-id="${post.id}"]`));
    }
    API.showToast('Posted', 'success');
  } catch (err) {
    postAlert.textContent = err.message || 'Failed to post';
    postAlert.classList.add('show');
  } finally {
    updatePostBtn();
    postBtn.textContent = 'Post';
  }
});

// ============ Feed rendering ============
function renderPostCard(p) {
  const img = p.image_url
    ? `<div class="post-image"><img src="${Utils.esc(p.image_url)}" alt="" loading="lazy"></div>`
    : '';
  const isMine = p.author.id === me.id;
  const deleteBtn = isMine
    ? `<button class="menu-btn" data-action="delete" title="Delete">🗑</button>` : '';
  return `
    <div class="card post-card hoverable" data-post-id="${p.id}">
      <div class="post-header">
        <a href="/profile.html?id=${p.author.id}" style="text-decoration:none;">${Utils.avatarHtml(p.author, 'md')}</a>
        <div class="meta">
          <a href="/profile.html?id=${p.author.id}" class="username" style="text-decoration:none; color:inherit;">${Utils.esc(p.author.username)}</a>
          <span class="timestamp">${Utils.timeAgo(p.created_at)}</span>
        </div>
        ${deleteBtn}
      </div>
      <div class="post-content" data-nav>${Utils.esc(p.content)}</div>
      ${img}
      <div class="post-actions">
        <button class="action-btn like-btn ${p.liked_by_current_user ? 'liked' : ''}" data-action="like">
          ${Utils.heartIcon(p.liked_by_current_user)}
          <span class="like-count">${p.like_count}</span>
        </button>
        <button class="action-btn" data-action="comment">
          ${Utils.commentIcon()}
          <span>${p.comment_count}</span>
        </button>
      </div>
    </div>`;
}

function bindCardHandlers(card) {
  if (!card) return;
  const postId = card.dataset.postId;

  card.querySelector('[data-action="like"]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const countEl = btn.querySelector('.like-count');
    const wasLiked = btn.classList.contains('liked');
    // Optimistic
    btn.classList.toggle('liked', !wasLiked);
    countEl.textContent = String(parseInt(countEl.textContent, 10) + (wasLiked ? -1 : 1));
    btn.querySelector('svg')?.replaceWith(...(() => {
      const tpl = document.createElement('template');
      tpl.innerHTML = Utils.heartIcon(!wasLiked);
      return tpl.content.childNodes;
    })());
    try {
      const res = await API.request(`/api/posts/${postId}/like`, { method: 'POST', auth: true });
      // Reconcile from server truth
      btn.classList.toggle('liked', res.liked);
      countEl.textContent = String(res.like_count);
      btn.querySelector('svg')?.replaceWith(...(() => {
        const tpl = document.createElement('template');
        tpl.innerHTML = Utils.heartIcon(res.liked);
        return tpl.content.childNodes;
      })());
    } catch (err) {
      // Roll back
      btn.classList.toggle('liked', wasLiked);
      countEl.textContent = String(parseInt(countEl.textContent, 10) + (wasLiked ? 1 : -1));
      API.showToast(err.message || 'Failed to like', 'error');
    }
  });

  card.querySelector('[data-action="comment"]')?.addEventListener('click', () => {
    window.location.href = `/post.html?id=${postId}`;
  });
  card.querySelector('[data-nav]')?.addEventListener('click', () => {
    window.location.href = `/post.html?id=${postId}`;
  });
  card.querySelector('[data-action="delete"]')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this post?')) return;
    try {
      await API.request(`/api/posts/${postId}`, { method: 'DELETE', auth: true });
      card.remove();
      API.showToast('Deleted', 'success');
    } catch (err) {
      API.showToast(err.message || 'Failed to delete', 'error');
    }
  });
}

// ============ Load ============
const listEl = document.getElementById('feed-list');
const loadMoreWrap = document.getElementById('load-more-wrap');

function skeleton() {
  return `<div class="card post-card">
    <div class="post-header">
      <div class="skeleton avatar md" style="border-radius:50%;"></div>
      <div style="flex:1;">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line" style="width:30%;"></div>
      </div>
    </div>
    <div class="skeleton skeleton-line med"></div>
    <div class="skeleton skeleton-line" style="width:80%;"></div>
  </div>`;
}

async function loadPage(reset = false) {
  if (loading || (!hasMore && !reset)) return;
  loading = true;
  if (reset) {
    page = 1; hasMore = true;
    listEl.innerHTML = skeleton() + skeleton();
  } else {
    loadMoreWrap.innerHTML = '<div class="spinner"></div>';
  }
  try {
    const path = currentFeed === 'following'
      ? `/api/feed/following?page=${page}&limit=20`
      : `/api/posts?page=${page}&limit=20`;
    const res = await API.request(path, { auth: true });
    if (reset) listEl.innerHTML = '';
    if (page === 1 && res.posts.length === 0) {
      listEl.innerHTML = `<div class="empty-state">
        <h3>${currentFeed === 'following' ? 'Your following feed is empty' : 'No posts yet'}</h3>
        <p>${currentFeed === 'following' ? 'Follow people to see their posts here.' : 'Be the first to post!'}</p>
      </div>`;
    } else {
      const html = res.posts.map(renderPostCard).join('');
      listEl.insertAdjacentHTML('beforeend', html);
      res.posts.forEach((p) => bindCardHandlers(document.querySelector(`[data-post-id="${p.id}"]`)));
    }
    hasMore = res.has_more;
    page += 1;
    loadMoreWrap.innerHTML = hasMore
      ? '<button class="btn btn-secondary btn-sm" id="load-more">Load more</button>'
      : '';
    document.getElementById('load-more')?.addEventListener('click', () => loadPage(false));
  } catch (err) {
    API.showToast(err.message || 'Failed to load feed', 'error');
    loadMoreWrap.innerHTML = '';
  } finally {
    loading = false;
  }
}

// Tabs
document.querySelectorAll('.feed-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.feed-tab').forEach((b) => {
      b.classList.remove('active', 'btn-secondary'); b.classList.add('btn-ghost');
    });
    btn.classList.add('active', 'btn-secondary'); btn.classList.remove('btn-ghost');
    currentFeed = btn.dataset.feed;
    loadPage(true);
  });
});

// Discover panel — a few users
async function loadDiscover() {
  try {
    // Cheap discover: latest posts, pick unique authors we don't follow yet.
    const res = await API.request('/api/posts?page=1&limit=20', { auth: true });
    const seen = new Set([me.id]);
    const users = [];
    for (const p of res.posts) {
      if (!seen.has(p.author.id)) { seen.add(p.author.id); users.push(p.author); }
      if (users.length >= 5) break;
    }
    const slot = document.getElementById('discover-slot');
    if (!users.length) { slot.textContent = 'No users to discover yet.'; return; }
    slot.innerHTML = users.map((u) => `
      <div class="rail-user">
        <a href="/profile.html?id=${u.id}" style="text-decoration:none;">${Utils.avatarHtml(u, 'sm')}</a>
        <div class="body">
          <a href="/profile.html?id=${u.id}" class="username" style="color:inherit; text-decoration:none;">${Utils.esc(u.username)}</a>
        </div>
      </div>`).join('');
  } catch { /* silent */ }
}

loadPage(true);
loadDiscover();
