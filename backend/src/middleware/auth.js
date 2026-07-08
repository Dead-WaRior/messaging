const prisma = require('../lib/prisma');
const { verifyToken, sanitizeUser } = require('../lib/auth');

// requireAuth: expects `Authorization: Bearer <token>`.
// On success, attaches sanitized user to req.user and calls next().
// On failure, returns 401.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    req.user = sanitizeUser(user);
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };
