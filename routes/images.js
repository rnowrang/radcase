const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Directories
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const THUMB_DIR = path.join(__dirname, '..', 'thumbnails');

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Upload images for a case
router.post('/cases/:id/images', requireAuth, upload.array('images', 20), async (req, res, next) => {
  try {
    const caseId = req.params.id;

    // Check if case exists
    const existing = db.prepare('SELECT id FROM cases WHERE id = ?').get(caseId);
    if (!existing) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    const insertImage = db.prepare(`
      INSERT INTO images (id, case_id, filename, original_name, sequence)
      VALUES (?, ?, ?, ?, ?)
    `);

    const currentMax = db.prepare('SELECT MAX(sequence) as maxSeq FROM images WHERE case_id = ?').get(caseId);
    let seq = (currentMax?.maxSeq || 0) + 1;

    const uploaded = [];
    const thumbnailErrors = [];

    for (const file of req.files) {
      const imageId = uuidv4();

      // Create thumbnail
      try {
        await sharp(file.path)
          .resize(400, 400, { fit: 'inside' })
          .toFile(path.join(THUMB_DIR, file.filename));
      } catch (e) {
        // If sharp fails (e.g., not an image), just copy the file
        console.warn(`Thumbnail generation failed for ${file.filename}: ${e.message}`);
        thumbnailErrors.push({ filename: file.filename, error: e.message });
        try {
          fs.copyFileSync(file.path, path.join(THUMB_DIR, file.filename));
        } catch (copyErr) {
          console.error(`Failed to copy file as thumbnail ${file.filename}:`, copyErr.message);
        }
      }

      insertImage.run(imageId, caseId, file.filename, file.originalname, seq++);
      uploaded.push({ id: imageId, filename: file.filename });
    }

    res.status(201).json({
      uploaded,
      ...(thumbnailErrors.length > 0 && { thumbnailWarnings: thumbnailErrors })
    });
  } catch (err) {
    next(err);
  }
});

// Update image annotations
router.put('/images/:id/annotations', requireAuth, (req, res, next) => {
  try {
    const { annotations } = req.body;

    // Check if image exists
    const existing = db.prepare('SELECT id FROM images WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Image not found' });
    }

    db.prepare('UPDATE images SET annotations = ? WHERE id = ?').run(JSON.stringify(annotations), req.params.id);
    res.json({ message: 'Annotations saved' });
  } catch (err) {
    next(err);
  }
});

// Delete image
router.delete('/images/:id', requireAuth, (req, res, next) => {
  try {
    const image = db.prepare('SELECT filename FROM images WHERE id = ?').get(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    fs.unlink(path.join(UPLOAD_DIR, image.filename), (err) => {
      if (err) console.error(`Failed to delete upload ${image.filename}:`, err.message);
    });
    fs.unlink(path.join(THUMB_DIR, image.filename), (err) => {
      if (err) console.error(`Failed to delete thumbnail ${image.filename}:`, err.message);
    });

    db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id);
    res.json({ message: 'Image deleted' });
  } catch (err) {
    next(err);
  }
});

// Get all tags
router.get('/tags', (req, res) => {
  const tags = db.prepare(`
    SELECT t.name, COUNT(ct.case_id) as count
    FROM tags t
    LEFT JOIN case_tags ct ON t.id = ct.tag_id
    GROUP BY t.id
    ORDER BY count DESC
  `).all();
  res.json(tags);
});

// Get filter options (distinct values)
router.get('/filters', (req, res) => {
  const modalities = db.prepare('SELECT DISTINCT modality FROM cases WHERE modality IS NOT NULL ORDER BY modality').all();
  const bodyParts = db.prepare('SELECT DISTINCT body_part FROM cases WHERE body_part IS NOT NULL ORDER BY body_part').all();

  res.json({
    modalities: modalities.map(m => m.modality),
    bodyParts: bodyParts.map(b => b.body_part),
    difficulties: [1, 2, 3, 4, 5]
  });
});

module.exports = router;
