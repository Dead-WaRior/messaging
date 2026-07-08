const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { optionalAuth } = require('../middleware/optionalAuth');
const { upload } = require('../lib/upload');
const {
  createPost, listPosts, getPost, deletePost,
} = require('../controllers/posts.controller');
const { toggleLike } = require('../controllers/likes.controller');
const {
  createComment, listComments,
} = require('../controllers/comments.controller');

const router = express.Router();

// Feed & CRUD
router.get('/', optionalAuth, listPosts);
router.post('/', requireAuth, upload.single('image'), createPost);
router.get('/:id', optionalAuth, getPost);
router.delete('/:id', requireAuth, deletePost);

// Likes
router.post('/:id/like', requireAuth, toggleLike);

// Comments on a post
router.get('/:id/comments', listComments);
router.post('/:id/comments', requireAuth, createComment);

module.exports = router;
