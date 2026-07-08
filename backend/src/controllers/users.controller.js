const prisma = require('../lib/prisma');
const { sanitizeUser } = require('../lib/auth');

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// GET /api/users/:id — public profile view.
// Includes posts/follower/following counts and (when authed) is_followed_by_current_user.
async function getUser(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid user id' });

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { posts: true, followers: true, following: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'user not found' });

    const safe = sanitizeUser(user);
    const counts = safe._count || { posts: 0, followers: 0, following: 0 };
    delete safe._count;

    let is_followed_by_current_user = false;
    if (req.user && req.user.id !== id) {
      const f = await prisma.follow.findUnique({
        where: { follower_id_following_id: { follower_id: req.user.id, following_id: id } },
        select: { id: true },
      });
      is_followed_by_current_user = !!f;
    }

    return res.json({
      user: {
        ...safe,
        posts_count: counts.posts,
        followers_count: counts.followers,
        following_count: counts.following,
        is_followed_by_current_user,
      },
    });
  } catch (err) {
    return next(err);
  }
}

// PUT /api/users/:id — edit own profile only.
// Editable fields: bio, profile_pic_url. (username/email intentionally not editable in v0.1.)
async function updateUser(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid user id' });

    if (!req.user || req.user.id !== id) {
      return res.status(403).json({ error: 'you can only edit your own profile' });
    }

    const { bio, profile_pic_url } = req.body || {};
    const data = {};
    if (bio !== undefined) {
      if (bio !== null && typeof bio !== 'string') {
        return res.status(400).json({ error: 'bio must be a string or null' });
      }
      if (typeof bio === 'string' && bio.length > 500) {
        return res.status(400).json({ error: 'bio must be 500 characters or fewer' });
      }
      data.bio = bio;
    }
    if (profile_pic_url !== undefined) {
      if (profile_pic_url !== null && typeof profile_pic_url !== 'string') {
        return res.status(400).json({ error: 'profile_pic_url must be a string or null' });
      }
      if (typeof profile_pic_url === 'string' && profile_pic_url.length > 500) {
        return res.status(400).json({ error: 'profile_pic_url too long' });
      }
      data.profile_pic_url = profile_pic_url;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'no editable fields provided' });
    }

    const updated = await prisma.user.update({ where: { id }, data });
    return res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    if (err && err.code === 'P2025') {
      return res.status(404).json({ error: 'user not found' });
    }
    return next(err);
  }
}

module.exports = { getUser, updateUser };
