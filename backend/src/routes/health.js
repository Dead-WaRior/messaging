const express = require('express');

const router = express.Router();

// GET /api/health — liveness probe. Returns 200 with { status: "ok" }.
router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
