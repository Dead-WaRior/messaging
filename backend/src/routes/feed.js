const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listPosts } = require('../controllers/posts.controller');

const router = express.Router();

// GET /api/feed/following — shortcut for listPosts with following=true
router.get('/following', requireAuth, (req, res, next) => {
  req.query.following = 'true';
  return listPosts(req, res, next);
});

module.exports = router;
