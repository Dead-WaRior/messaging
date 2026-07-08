const prisma = require('../lib/prisma');

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function shapeUser(u) {
  return { id: u.id, username: u.username, profile_pic_url: u.profile_pic_url, bio: u.bio };
}

// POST /api/users/:id/follow — toggle follow.
async function toggleFollow(req, res, next) {
  try {
    const following_id = parseId(req.params.id);
    if (!following_id) return res.status(400).json({ error: 'invalid user id' });
    const follower_id = req.user.id;

    if (following_id === follower_id) {
      return res.status(400).json({ error: 'you cannot follow yourself' });
    }

    const target = await prisma.user.findUnique({ where: { id: following_id }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'user not found' });

    const existing = await prisma.follow.findUnique({
      where: { follower_id_following_id: { follower_id, following_id } },
      select: { id: true },
    });

    let following;
    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      following = false;
    } else {
      try {
        await prisma.follow.create({ data: { follower_id, following_id } });
        following = true;
      } catch (err) {
        if (err && err.code === 'P2002') following = true;
        else throw err;
      }
    }
    const [followers_count, following_count] = await Promise.all([
      prisma.follow.count({ where: { following_id } }),
      prisma.follow.count({ where: { follower_id: following_id } }),
    ]);
    return res.json({ following, followers_count, following_count });
  } catch (err) {
    return next(err);
  }
}

// GET /api/users/:id/followers — users who follow :id
async function listFollowers(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid user id' });
    const rows = await prisma.follow.findMany({
      where: { following_id: id },
      orderBy: { created_at: 'desc' },
      include: { follower: { select: { id: true, username: true, profile_pic_url: true, bio: true } } },
    });
    return res.json({ users: rows.map((r) => shapeUser(r.follower)) });
  } catch (err) {
    return next(err);
  }
}

// GET /api/users/:id/following — users :id follows
async function listFollowing(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid user id' });
    const rows = await prisma.follow.findMany({
      where: { follower_id: id },
      orderBy: { created_at: 'desc' },
      include: { following: { select: { id: true, username: true, profile_pic_url: true, bio: true } } },
    });
    return res.json({ users: rows.map((r) => shapeUser(r.following)) });
  } catch (err) {
    return next(err);
  }
}

module.exports = { toggleFollow, listFollowers, listFollowing };
