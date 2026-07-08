const prisma = require('../lib/prisma');

const MAX_CONTENT = 2000;

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function shapeComment(c) {
  return {
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    post_id: c.post_id,
    author: {
      id: c.author.id,
      username: c.author.username,
      profile_pic_url: c.author.profile_pic_url,
    },
  };
}

// POST /api/posts/:id/comments — auth required.
async function createComment(req, res, next) {
  try {
    const post_id = parseId(req.params.id);
    if (!post_id) return res.status(400).json({ error: 'invalid post id' });
    const { content } = req.body || {};
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }
    if (content.length > MAX_CONTENT) {
      return res.status(400).json({ error: `content must be ${MAX_CONTENT} characters or fewer` });
    }

    const postExists = await prisma.post.findUnique({ where: { id: post_id }, select: { id: true } });
    if (!postExists) return res.status(404).json({ error: 'post not found' });

    const comment = await prisma.comment.create({
      data: { post_id, user_id: req.user.id, content: content.trim() },
      include: { author: { select: { id: true, username: true, profile_pic_url: true } } },
    });
    return res.status(201).json({ comment: shapeComment(comment) });
  } catch (err) {
    return next(err);
  }
}

// GET /api/posts/:id/comments — public, oldest first (chronological reading order).
async function listComments(req, res, next) {
  try {
    const post_id = parseId(req.params.id);
    if (!post_id) return res.status(400).json({ error: 'invalid post id' });

    const postExists = await prisma.post.findUnique({ where: { id: post_id }, select: { id: true } });
    if (!postExists) return res.status(404).json({ error: 'post not found' });

    const rows = await prisma.comment.findMany({
      where: { post_id },
      orderBy: { created_at: 'asc' },
      include: { author: { select: { id: true, username: true, profile_pic_url: true } } },
    });
    return res.json({ comments: rows.map(shapeComment) });
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/comments/:id — author only.
async function deleteComment(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid comment id' });

    const comment = await prisma.comment.findUnique({ where: { id }, select: { user_id: true } });
    if (!comment) return res.status(404).json({ error: 'comment not found' });
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'you can only delete your own comments' });
    }
    await prisma.comment.delete({ where: { id } });
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

module.exports = { createComment, listComments, deleteComment };
