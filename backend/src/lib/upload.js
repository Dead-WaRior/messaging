const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 6);
    const safeExt = /^\.(jpg|jpeg|png|gif|webp)$/i.test(ext) ? ext : '.jpg';
    const name = crypto.randomBytes(12).toString('hex') + safeExt;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  if (!/^image\/(jpe?g|png|gif|webp)$/i.test(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, GIF, or WebP images are allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

module.exports = { upload, UPLOAD_DIR };
