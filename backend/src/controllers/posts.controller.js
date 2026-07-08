const prisma = require('../lib/prisma');

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const MAX_CONTENT = 5000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// Shape a Prisma post record for the API.
// Requires `include: { author, _count: { select: { comments, likes } } }`.
function shapePost(p, likedIds = null) {
  return {
    id: p.id,
    content: p.content,
    image_url: p.image_url,
    created_at: p.created_at,
    author: {
      id: p.author.id,
      username: p.author.username,
      profile_pic_url: p.author.profile_pic_url,
    },
    like_count: p._count.likes,
    comment_count: p._count.comments,
    liked_by_current_user: likedIds ? likedIds.has(p.id) : false,
  };
}

// POST /api/posts — auth required. Body: { content, image_url? }
// If a file was uploaded via multer, image_url is derived from it.
async function createPost(req, res, next) {
  try {
    let { content, image_url } = req.body || {};
    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    }
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }
    if (content.length > MAX_CONTENT) {
      return res.status(400).json({ error: `content must be ${MAX_CONTENT} characters or fewer` });
    }
    if (image_url !== undefined && image_url !== null && typeof image_url !== 'string') {
      return res.status(400).json({ error: 'image_url must be a string' });
    }

    const post = await prisma.post.create({
      data: {
        user_id: req.user.id,
        content: content.trim(),
        image_url: image_url || null,
      },
      include: {
        author: { select: { id: true, username: true, profile_pic_url: true } },
        _count: { select: { comments: true, likes: true } },
      },
    });
    return res.status(201).json({ post: shapePost(post) });
  } catch (err) {
    return next(err);
  }
}

// GET /api/posts — paginated feed, newest first.
// Query: ?page=1&limit=20&user_id=<int>&following=true
// If `following=true` and user is authed, restricts to posts by users the current user follows.
async function listPosts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE));
    const userIdFilter = parseId(req.query.user_id);
    const followingOnly = req.query.following === 'true';

    const where = {};
    if (userIdFilter) where.user_id = userIdFilter;

    if (followingOnly) {
      if (!req.user) return res.status(401).json({ error: 'authentication required for following feed' });
      const follows = await prisma.follow.findMany({
        where: { follower_id: req.user.id },
        select: { following_id: true },
      });
      const ids = follows.map((f) => f.following_id);
      // Include the user themself so their own posts show up in their following feed.
      ids.push(req.user.id);
      where.user_id = { in: ids };
    }

    const [total, rows] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { id: true, username: true, profile_pic_url: true } },
          _count: { select: { comments: true, likes: true } },
        },
      }),
    ]);

    let likedIds = null;
    if (req.user && rows.length) {
      const likes = await prisma.like.findMany({
        where: { user_id: req.user.id, post_id: { in: rows.map((p) => p.id) } },
        select: { post_id: true },
      });
      likedIds = new Set(likes.map((l) => l.post_id));
    }

    return res.json({
      posts: rows.map((p) => shapePost(p, likedIds)),
      page,
      limit,
      total,
      has_more: page * limit < total,
    });
  } catch (err) {
    return next(err);
  }
}

// GET /api/posts/:id
async function getPost(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid post id' });

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, profile_pic_url: true } },
        _count: { select: { comments: true, likes: true } },
      },
    });
    if (!post) return res.status(404).json({ error: 'post not found' });

    let likedIds = null;
    if (req.user) {
      const like = await prisma.like.findUnique({
        where: { post_id_user_id: { post_id: id, user_id: req.user.id } },
      });
      likedIds = new Set(like ? [id] : []);
    }
    return res.json({ post: shapePost(post, likedIds) });
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/posts/:id — author only.
async function deletePost(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid post id' });

    const post = await prisma.post.findUnique({ where: { id }, select: { user_id: true } });
    if (!post) return res.status(404).json({ error: 'post not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'you can only delete your own posts' });

    await prisma.post.delete({ where: { id } });
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

module.exports = { createPost, listPosts, getPost, deletePost };
