const express = require('express');
const { getUser, updateUser } = require('../controllers/users.controller');
const { toggleFollow, listFollowers, listFollowing } = require('../controllers/follows.controller');
const { listPosts } = require('../controllers/posts.controller');
const { requireAuth } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');

const router = express.Router();

// Profile
router.get('/:id', optionalAuth, getUser);
router.put('/:id', requireAuth, updateUser);

// User's posts (nice-to-have for profile page — Task 4 stub, now real)
router.get('/:id/posts', optionalAuth, (req, res, next) => {
  req.query.user_id = req.params.id;
  return listPosts(req, res, next);
});

// Follows
router.post('/:id/follow', requireAuth, toggleFollow);
router.get('/:id/followers', listFollowers);
router.get('/:id/following', listFollowing);

module.exports = router;
