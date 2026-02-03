const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');

const router = express.Router();

// Directories
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const THUMB_DIR = path.join(__dirname, '..', 'thumbnails');

// Get analytics
router.get('/', (req, res) => {
  const caseCount = db.prepare('SELECT COUNT(*) as count FROM cases').get();
  const imageCount = db.prepare('SELECT COUNT(*) as count FROM images').get();
  const tagCount = db.prepare('SELECT COUNT(*) as count FROM tags').get();

  const byModality = db.prepare(`
    SELECT modality, COUNT(*) as count
    FROM cases
    WHERE modality IS NOT NULL
    GROUP BY modality
    ORDER BY count DESC
  `).all();

  const byBodyPart = db.prepare(`
    SELECT body_part, COUNT(*) as count
    FROM cases
    WHERE body_part IS NOT NULL
    GROUP BY body_part
    ORDER BY count DESC
  `).all();

  const recentCases = db.prepare(`
    SELECT id, title, modality, created_at
    FROM cases
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  res.json({
    counts: {
      cases: caseCount.count,
      images: imageCount.count,
      tags: tagCount.count
    },
    byModality,
    byBodyPart,
    recentCases
  });
});

// Export all cases - mounted at /api/export
router.get('/', (req, res) => {
  const cases = db.prepare(`
    SELECT c.*, GROUP_CONCAT(DISTINCT t.name) as tags
    FROM cases c
    LEFT JOIN case_tags ct ON c.id = ct.case_id
    LEFT JOIN tags t ON ct.tag_id = t.id
    GROUP BY c.id
  `).all();

  const exportData = cases.map(c => {
    const images = db.prepare('SELECT * FROM images WHERE case_id = ?').all(c.id);
    return {
      ...c,
      tags: c.tags ? c.tags.split(',') : [],
      images: images.map(img => ({
        ...img,
        data: fs.existsSync(path.join(UPLOAD_DIR, img.filename))
          ? fs.readFileSync(path.join(UPLOAD_DIR, img.filename), 'base64')
          : null
      }))
    };
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="radcase-export-${new Date().toISOString().split('T')[0]}.json"`);
  res.json({
    version: 1,
    exportDate: new Date().toISOString(),
    caseCount: cases.length,
    cases: exportData
  });
});

// Import cases
router.post('/import', express.json({ limit: '100mb' }), async (req, res) => {
  const { cases } = req.body;

  if (!cases || !Array.isArray(cases)) {
    return res.status(400).json({ error: 'Invalid import format' });
  }

  let imported = 0;
  let errors = [];

  for (const c of cases) {
    try {
      const id = uuidv4();

      db.prepare(`
        INSERT INTO cases (id, title, modality, body_part, diagnosis, difficulty, clinical_history, teaching_points, findings)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, c.title, c.modality, c.body_part, c.diagnosis, c.difficulty || 2, c.clinical_history, c.teaching_points, c.findings);

      if (c.tags && c.tags.length > 0) {
        const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
        const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
        const linkTag = db.prepare('INSERT INTO case_tags (case_id, tag_id) VALUES (?, ?)');

        for (const tagName of c.tags) {
          insertTag.run(tagName.trim().toLowerCase());
          const tag = getTagId.get(tagName.trim().toLowerCase());
          if (tag) linkTag.run(id, tag.id);
        }
      }

      if (c.images && c.images.length > 0) {
        for (let i = 0; i < c.images.length; i++) {
          const img = c.images[i];
          if (img.data) {
            const imageId = uuidv4();
            const ext = path.extname(img.original_name || img.filename || '.jpg');
            const filename = `${imageId}${ext}`;

            const buffer = Buffer.from(img.data, 'base64');
            fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

            try {
              await sharp(buffer)
                .resize(400, 400, { fit: 'inside' })
                .toFile(path.join(THUMB_DIR, filename));
            } catch (e) {
              fs.copyFileSync(path.join(UPLOAD_DIR, filename), path.join(THUMB_DIR, filename));
            }

            db.prepare(`
              INSERT INTO images (id, case_id, filename, original_name, sequence, annotations)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(imageId, id, filename, img.original_name, i, img.annotations);
          }
        }
      }

      imported++;
    } catch (err) {
      errors.push({ case: c.title, error: err.message });
    }
  }

  res.json({ imported, errors });
});

module.exports = router;
