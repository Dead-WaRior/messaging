const prisma = require('../lib/prisma');
const { hashPassword, verifyPassword, signToken, sanitizeUser } = require('../lib/auth');

// Basic input validators — kept lightweight to avoid adding a validation lib.
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

async function register(req, res, next) {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        error: 'username must be 3-30 chars, letters/numbers/._- only',
      });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'invalid email' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LEN) {
      return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LEN} characters` });
    }

    // Uniqueness pre-check for a nicer error than a raw DB constraint violation.
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: email.toLowerCase() }] },
    });
    if (existing) {
      const field = existing.username === username ? 'username' : 'email';
      return res.status(409).json({ error: `${field} already in use` });
    }

    const password_hash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        password_hash,
      },
    });

    const token = signToken({ sub: user.id, username: user.username });
    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (err) {
    // Handle race-condition unique violations
    if (err && err.code === 'P2002') {
      return res.status(409).json({ error: 'username or email already in use' });
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { identifier, username, email, password } = req.body || {};
    // Accept either { identifier } (username OR email) or explicit { username }/{ email }.
    const login = identifier || username || email;

    if (!login || !password) {
      return res.status(400).json({ error: 'identifier (username or email) and password are required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: login }, { email: login.toLowerCase() }],
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const token = signToken({ sub: user.id, username: user.username });
    return res.status(200).json({ user: sanitizeUser(user), token });
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login };
