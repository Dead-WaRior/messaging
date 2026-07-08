const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { deleteComment } = require('../controllers/comments.controller');

const router = express.Router();
router.delete('/:id', requireAuth, deleteComment);

module.exports = router;
