const prisma = require('../lib/prisma');

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// POST /api/posts/:id/like — toggle like for current user on this post.
async function toggleLike(req, res, next) {
  try {
    const post_id = parseId(req.params.id);
    if (!post_id) return res.status(400).json({ error: 'invalid post id' });
    const user_id = req.user.id;

    const post = await prisma.post.findUnique({ where: { id: post_id }, select: { id: true } });
    if (!post) return res.status(404).json({ error: 'post not found' });

    const existing = await prisma.like.findUnique({
      where: { post_id_user_id: { post_id, user_id } },
      select: { id: true },
    });

    let liked;
    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      // Try/catch guards against the race where two concurrent toggles both see
      // no row and both try to insert — one will fail with P2002.
      try {
        await prisma.like.create({ data: { post_id, user_id } });
        liked = true;
      } catch (err) {
        if (err && err.code === 'P2002') {
          liked = true; // someone else won the race; state is now "liked"
        } else {
          throw err;
        }
      }
    }
    const like_count = await prisma.like.count({ where: { post_id } });
    return res.json({ liked, like_count });
  } catch (err) {
    return next(err);
  }
}

module.exports = { toggleLike };
