if (!API.requireAuthOrRedirect()) throw new Error('redirecting');
renderSidebar('home');

const me = API.getCurrentUser();
document.getElementById('me-avatar-slot').innerHTML = Utils.avatarHtml(me, 'md');

const postId = new URLSearchParams(window.location.search).get('id');
if (!postId) window.location.href = '/feed.html';

const postSlot = document.getElementById('post-slot');
const commentsSlot = document.getElementById('comments-slot');

function renderPost(p) {
  const img = p.image_url
    ? `<div class="post-image"><img src="${Utils.esc(p.image_url)}" alt=""></div>` : '';
  const isMine = p.author.id === me.id;
  const deleteBtn = isMine
    ? `<button class="menu-btn" id="delete-post" title="Delete">🗑</button>` : '';
  postSlot.innerHTML = `
    <div class="card post-card">
      <div class="post-header">
        <a href="/profile.html?id=${p.author.id}" style="text-decoration:none;">${Utils.avatarHtml(p.author, 'md')}</a>
        <div class="meta">
          <a href="/profile.html?id=${p.author.id}" class="username" style="text-decoration:none; color:inherit;">${Utils.esc(p.author.username)}</a>
          <span class="timestamp">${Utils.timeAgo(p.created_at)}</span>
        </div>
        ${deleteBtn}
      </div>
      <div class="post-content">${Utils.esc(p.content)}</div>
      ${img}
      <div class="post-actions">
        <button class="action-btn like-btn ${p.liked_by_current_user ? 'liked' : ''}" id="like-btn">
          ${Utils.heartIcon(p.liked_by_current_user)}
          <span class="like-count">${p.like_count}</span>
        </button>
        <span class="action-btn" style="pointer-events:none;">
          ${Utils.commentIcon()}
          <span>${p.comment_count}</span>
        </span>
      </div>
    </div>`;

  document.getElementById('like-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const countEl = btn.querySelector('.like-count');
    const wasLiked = btn.classList.contains('liked');
    try {
      const res = await API.request(`/api/posts/${postId}/like`, { method: 'POST', auth: true });
      btn.classList.toggle('liked', res.liked);
      countEl.textContent = String(res.like_count);
      const tpl = document.createElement('template');
      tpl.innerHTML = Utils.heartIcon(res.liked);
      btn.querySelector('svg')?.replaceWith(tpl.content.firstChild);
    } catch (err) {
      API.showToast(err.message || 'Failed', 'error');
    }
  });

  document.getElementById('delete-post')?.addEventListener('click', async () => {
    if (!confirm('Delete this post? This also deletes its comments.')) return;
    try {
      await API.request(`/api/posts/${postId}`, { method: 'DELETE', auth: true });
      API.showToast('Deleted', 'success');
      setTimeout(() => window.location.href = '/feed.html', 500);
    } catch (err) {
      API.showToast(err.message || 'Failed to delete', 'error');
    }
  });
}

function renderComments(comments) {
  if (!comments.length) {
    commentsSlot.innerHTML = '<p class="text-muted" style="text-align:center; padding: 16px;">No comments yet — be the first.</p>';
    return;
  }
  commentsSlot.innerHTML = comments.map((c) => `
    <div class="comment" data-comment-id="${c.id}">
      <a href="/profile.html?id=${c.author.id}" style="text-decoration:none;">${Utils.avatarHtml(c.author, 'sm')}</a>
      <div class="body">
        <div class="head">
          <a href="/profile.html?id=${c.author.id}" class="username" style="color:inherit; text-decoration:none;">${Utils.esc(c.author.username)}</a>
          <span class="timestamp">${Utils.timeAgo(c.created_at)}</span>
        </div>
        <p>${Utils.esc(c.content)}</p>
      </div>
      ${c.author.id === me.id ? '<button class="delete-btn" data-action="delete-comment">Delete</button>' : ''}
    </div>`).join('');
  commentsSlot.querySelectorAll('[data-action="delete-comment"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const commentEl = btn.closest('.comment');
      const cid = commentEl.dataset.commentId;
      if (!confirm('Delete this comment?')) return;
      try {
        await API.request(`/api/comments/${cid}`, { method: 'DELETE', auth: true });
        commentEl.remove();
      } catch (err) {
        API.showToast(err.message || 'Failed', 'error');
      }
    });
  });
}

async function load() {
  try {
    const [p, c] = await Promise.all([
      API.request(`/api/posts/${postId}`, { auth: true }),
      API.request(`/api/posts/${postId}/comments`),
    ]);
    renderPost(p.post);
    renderComments(c.comments);
  } catch (err) {
    postSlot.innerHTML = `<div class="card empty-state"><h3>${err.status === 404 ? 'Post not found' : 'Something went wrong'}</h3><p>${Utils.esc(err.message || '')}</p></div>`;
    commentsSlot.textContent = '';
  }
}

document.getElementById('comment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const contentEl = document.getElementById('comment-content');
  const btn = document.getElementById('comment-btn');
  const content = contentEl.value.trim();
  if (!content) return;
  btn.disabled = true;
  try {
    await API.request(`/api/posts/${postId}/comments`, {
      method: 'POST', auth: true, body: { content },
    });
    contentEl.value = '';
    // Re-fetch list per spec ("no need for WebSockets — re-fetch after posting")
    const c = await API.request(`/api/posts/${postId}/comments`);
    renderComments(c.comments);
  } catch (err) {
    API.showToast(err.message || 'Failed to comment', 'error');
  } finally {
    btn.disabled = false;
  }
});

load();
