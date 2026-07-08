// Shared API client. Reads token from localStorage under key 'token'.

const API_BASE = ''; // same-origin; backend serves the frontend in dev.
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function apiRequest(path, { method = 'GET', body, auth = false, form = null } = {}) {
  const headers = {};
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let sendBody;
  if (form instanceof FormData) {
    sendBody = form; // browser sets Content-Type with boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    sendBody = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: sendBody,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Auth guard: redirect to login if not authenticated.
function requireAuthOrRedirect() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// Toast helper
function showToast(message, type = 'info') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast show ${type === 'error' ? 'error' : ''}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 2600);
}

window.API = {
  request: apiRequest,
  getToken, setAuth, clearAuth, getCurrentUser,
  requireAuthOrRedirect, showToast,
};
