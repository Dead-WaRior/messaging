const prisma = require('../lib/prisma');
const { verifyToken, sanitizeUser } = require('../lib/auth');

// optionalAuth: if a valid Bearer token is present, attach req.user.
// If missing or invalid, silently continue with req.user = null.
// Used on endpoints that return different data for logged-in users (e.g. liked_by_current_user).
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      req.user = null;
      return next();
    }
    let payload;
    try { payload = verifyToken(token); } catch { req.user = null; return next(); }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    req.user = user ? sanitizeUser(user) : null;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { optionalAuth };
