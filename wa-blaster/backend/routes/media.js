const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR } = require('../config');

const uploadPath = path.join(__dirname, '..', UPLOAD_DIR);
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_SIZE = 16 * 1024 * 1024; // 16MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Jenis fail tidak disokong. Guna JPG, PNG, GIF, MP4 sahaja.'));
  },
});

// Upload media
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Tiada fail dihantar' });

    res.json({
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  });
});

// Senarai media
router.get('/', (_req, res) => {
  const files = fs.readdirSync(uploadPath).map(name => {
    const stat = fs.statSync(path.join(uploadPath, name));
    return { filename: name, size: stat.size };
  });
  res.json(files);
});

// Buang fail media
router.delete('/:filename', (req, res) => {
  const filePath = path.join(uploadPath, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fail tidak dijumpai' });
  fs.unlinkSync(filePath);
  res.json({ ok: true });
});

module.exports = router;
