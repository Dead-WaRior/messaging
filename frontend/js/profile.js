if (!API.requireAuthOrRedirect()) throw new Error('redirecting');

const me = API.getCurrentUser();
if (!me) { API.clearAuth(); window.location.href = '/login.html'; }

// If no ?id, show own profile.
const params = new URLSearchParams(window.location.search);
const profileId = parseInt(params.get('id'), 10) || me.id;
const isSelf = profileId === me.id;

renderSidebar(isSelf ? 'profile' : 'home');

const card = document.getElementById('profile-card');
const postsSlot = document.getElementById('posts-slot');

let currentUser = null;

function renderProfile(u) {
  currentUser = u;
  const followBtn = isSelf
    ? `<button class="btn btn-secondary btn-sm" id="edit-btn">Edit Profile</button>`
    : `<button class="btn ${u.is_followed_by_current_user ? 'btn-secondary' : 'btn-primary'} btn-sm" id="follow-btn">
        ${u.is_followed_by_current_user ? 'Following' : 'Follow'}
       </button>`;

  card.innerHTML = `
    <div class="profile-header">
      ${Utils.avatarHtml(u, 'lg')}
      <div class="info">
        <h1>${Utils.esc(u.username)}</h1>
        ${isSelf ? `<div class="text-muted">${Utils.esc(u.email)}</div>` : ''}
        <p class="text-secondary" style="margin-top:8px; white-space:pre-wrap;">${Utils.esc(u.bio || '')}</p>
        <div class="stats">
          <span><b>${u.posts_count}</b> posts</span>
          <span><b>${u.followers_count}</b> followers</span>
          <span><b>${u.following_count}</b> following</span>
        </div>
        <div class="actions">${followBtn}</div>
      </div>
    </div>
    <div id="edit-form-slot"></div>
  `;

  if (isSelf) {
    document.getElementById('edit-btn')?.addEventListener('click', showEditForm);
  } else {
    document.getElementById('follow-btn')?.addEventListener('click', toggleFollow);
  }
}

function showEditForm() {
  const slot = document.getElementById('edit-form-slot');
  slot.innerHTML = `
    <div style="padding: 0 20px 20px;">
      <div id="alert" class="alert alert-error"></div>
      <div class="form-group">
        <label for="bio">Bio</label>
        <textarea class="input" id="bio" maxlength="500">${Utils.esc(currentUser.bio || '')}</textarea>
      </div>
      <div class="form-group">
        <label for="profile_pic_url">Profile picture URL</label>
        <input class="input" type="url" id="profile_pic_url" value="${Utils.esc(currentUser.profile_pic_url || '')}" placeholder="https://…" />
      </div>
      <div class="row">
        <button class="btn btn-primary btn-sm" id="save-btn">Save</button>
        <button class="btn btn-ghost btn-sm" id="cancel-btn">Cancel</button>
      </div>
    </div>`;
  const alertEl = document.getElementById('alert');
  document.getElementById('cancel-btn').addEventListener('click', () => { slot.innerHTML = ''; });
  document.getElementById('save-btn').addEventListener('click', async () => {
    alertEl.classList.remove('show');
    const bio = document.getElementById('bio').value;
    const profile_pic_url = document.getElementById('profile_pic_url').value.trim() || null;
    try {
      const res = await API.request(`/api/users/${me.id}`, {
        method: 'PUT', auth: true, body: { bio, profile_pic_url },
      });
      // update cache
      API.setAuth(API.getToken(), { ...API.getCurrentUser(), ...res.user });
      slot.innerHTML = '';
      await loadProfile();
      API.showToast('Profile updated', 'success');
    } catch (err) {
      alertEl.textContent = err.message || 'Update failed';
      alertEl.classList.add('show');
    }
  });
}

async function toggleFollow() {
  const btn = document.getElementById('follow-btn');
  const wasFollowing = btn.textContent.trim() === 'Following';
  btn.disabled = true;
  try {
    const res = await API.request(`/api/users/${profileId}/follow`, { method: 'POST', auth: true });
    currentUser.is_followed_by_current_user = res.following;
    currentUser.followers_count = res.followers_count;
    renderProfile(currentUser);
  } catch (err) {
    API.showToast(err.message || 'Failed', 'error');
    btn.disabled = false;
  }
}

function renderPost(p) {
  const img = p.image_url
    ? `<div class="post-image"><img src="${Utils.esc(p.image_url)}" alt="" loading="lazy"></div>` : '';
  return `
    <div class="card post-card hoverable" onclick="window.location.href='/post.html?id=${p.id}'" style="cursor:pointer;">
      <div class="post-header">
        ${Utils.avatarHtml(p.author, 'md')}
        <div class="meta">
          <span class="username">${Utils.esc(p.author.username)}</span>
          <span class="timestamp">${Utils.timeAgo(p.created_at)}</span>
        </div>
      </div>
      <div class="post-content">${Utils.esc(p.content)}</div>
      ${img}
      <div class="post-actions">
        <span class="action-btn" style="pointer-events:none; color: ${p.liked_by_current_user ? 'var(--accent-red)' : 'var(--text-secondary)'};">
          ${Utils.heartIcon(p.liked_by_current_user)}
          <span>${p.like_count}</span>
        </span>
        <span class="action-btn" style="pointer-events:none;">
          ${Utils.commentIcon()}
          <span>${p.comment_count}</span>
        </span>
      </div>
    </div>`;
}

async function loadPosts() {
  try {
    const res = await API.request(`/api/users/${profileId}/posts?page=1&limit=50`, { auth: true });
    if (!res.posts.length) {
      postsSlot.innerHTML = `<div class="card empty-state"><h3>No posts yet</h3></div>`;
      return;
    }
    postsSlot.innerHTML = res.posts.map(renderPost).join('');
  } catch (err) {
    postsSlot.innerHTML = `<div class="card empty-state"><p>${Utils.esc(err.message || 'Failed to load posts')}</p></div>`;
  }
}

async function loadProfile() {
  try {
    const res = await API.request(`/api/users/${profileId}`, { auth: true });
    renderProfile(res.user);
    if (isSelf) {
      API.setAuth(API.getToken(), { ...API.getCurrentUser(), ...res.user });
    }
    await loadPosts();
  } catch (err) {
    card.innerHTML = `<div class="empty-state"><h3>${err.status === 404 ? 'User not found' : 'Something went wrong'}</h3><p>${Utils.esc(err.message || '')}</p></div>`;
  }
}

loadProfile();
